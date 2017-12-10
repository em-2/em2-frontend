import React, { Component } from 'react'
import {Link} from 'react-router-dom'
import {create_user_db} from '../db'
import worker from '../worker'
import {format_ts} from '../utils'
import Participants from './Participants'
import {Detail, ConversationNotFound} from './Shared'


// TODO style, font and img files need to be proxied through a service which caches them
const IFRAME_CSP = [
  "default-src 'none'",
  "script-src 'sha256-hCCdjTZJ2yzHJhj2yvB/A5XBZYcyiiwgMXFDGo065l0='",
  "style-src 'unsafe-inline'",
  "font-src 'unsafe-inline'",
  "img-src 'unsafe-inline' *",
].join(';')

function send_iframe_msg (id, msg) {
  document.getElementById(id).contentWindow.postMessage(msg, '*')
}


const Message = props => {
  // console.log(props.msg)
  const actions = props.msg_actions[props.msg.key]
  const first_action = actions[0]

  const height = props.msg_heights[props.msg.key]
  const styles = height ? {height: height + 'px'} : {}
  // TODO does this do terrible things to performance? should the css be moved to a separate file?
  // TODO move css to separate file
  const src = `data:text/html;charset=utf-8,<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta http-equiv="Content-Security-Policy" content="${IFRAME_CSP}">
    <style>
      html, body {
        min-height: 50px;
      }
      body {
        font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,
        Ubuntu,Cantarell,Fira Sans, Droid Sans,Helvetica Neue,sans-serif;
        margin: 0;
      }
    </style>
    <script>
      window.onload = function () {
        window.parent.postMessage({
          msgkey: document.body.getAttribute('data-msgkey'), 
          height: document.documentElement.offsetHeight > 50 ? document.documentElement.offsetHeight : null,
        }, '*')
      }
    </script>
  </head>
  <body data-msgkey="${props.msg.key}">
    ${props.msg.body}
  </body>
</html>
`
  setTimeout(() => send_iframe_msg(props.msg.key, props.msg.body), 50)
  return (
    <div className="box-msg">
      <div className="head row">
        <div className="col">
          {first_action.actor}
          <span className="text-muted ml-2">{format_ts(first_action.timestamp)}</span>
        </div>
        <div className="col text-right">
          <button type="button" className="btn btn-secondary btn-sm">edit</button>
        </div>
      </div>
      <div className="body">
        <iframe id={props.msg.key} title={props.msg.key} src={src} style={styles}/>
      </div>
    </div>
  )
}

class ConversationDetails extends Component {
  constructor (props) {
    super(props)
    this.state = {
      conv: {},
      conv_found: null,
      messages: [],
      participants: [],
      new_message: '',
      publish_allowed: true,
      action_count: 0,
      msg_actions: {},
      msg_heights: {},
    }
    this.send_new_message = this.send_new_message.bind(this)
    this.add_message = this.add_message.bind(this)
    this.prts_change = this.prts_change.bind(this)
    this.publish_draft = this.publish_draft.bind(this)
    this.db = null
  }

  async componentDidMount () {
    this._ismounted = true
    let found_conv = null
    try {
      found_conv = await this.get_conv()
    } catch (e) {
      // occasionally happens on first load, perhaps when db isn't full created
    }
    // console.log('found_conv', found_conv)
    if (!found_conv || !found_conv.last_comms || found_conv.last_comms <= window.connected_at) {
      // conversation might be out of date, updating it
      worker.postMessage({method: 'update_single_conv', args: {conv_key: this.props.conv_key}})
    }
    window.addEventListener('message', e => {
      if (e.data.height) {
        const msg_heights = Object.assign({}, this.state.msg_heights)
        msg_heights[e.data.msgkey] = e.data.height
        this.setState({msg_heights})
      }
    }, false)

    this.listener_id = worker.add_listener('conv', async args => {
      if (args.conv_key === this.props.conv_key) {
        this.get_conv()
      }
    })
  }

  componentWillUnmount () {
    this._ismounted = false
    worker.remove_listener(this.listener_id)
    this.props.updateGlobal({nav_edit_arg: null})
  }

  async get_conv () {
    this.db = this.db || await create_user_db()
    const db = this.db
    return await this.db.transaction('r', db.convs, db.messages, db.participants, db.actions, async () => {
      let conv = await db.convs.get(this.props.conv_key)
      if (!conv) {
        conv = await db.convs.get({old_key: this.props.conv_key})
        if (conv) {
          this.props.history.push('/' + conv.key)
        } else {
          this._ismounted && this.setState({conv_found: false})
        }
        return null
      }
      const messages = await db.messages.where({conv_key: conv.key}).toArray()
      messages.sort((a, b) => a.position - b.position)
      const participants = (await db.participants.where({conv_key: conv.key}).toArray()).map(p => p.address)
      const actions = await db.actions.where({conv_key: conv.key}).reverse().sortBy('timestamp')

      // current msg_actions and action_count are the only uses of actions here
      const msg_actions = {}
      for (let action of actions) {
        if (action.component === 'message') {
          if(msg_actions[action.message]) {
            msg_actions[action.message].push(action)
          } else {
            msg_actions[action.message] = [action]
          }
        }
      }

      if (this._ismounted) {
        this.setState({conv, messages, participants, msg_actions, action_count: actions.length, conv_found: true})
        this.props.updateGlobal({nav_edit_arg: conv.key})
        this.props.updateGlobal({
          page_title: conv.subject,
          nav_title: conv.subject + (conv.published ? '' : ' (draft)'),
        })
      }

      return conv
    }).catch(e => console.error(e.stack || e))
  }

  send_new_message () {
    worker.postMessage({
      method: 'add_message',
      args: {
        body: this.state.new_message,
        conv_key: this.props.conv_key,
        msg_key: this.state.messages[this.state.messages.length - 1].key
      }
    })
    this.setState({new_message: ''})
  }

  add_message () {
    return <div className="box">
      <div className="form-group">
        <textarea value={this.state.new_message}
                  onChange={(e) => this.setState({new_message: e.target.value})}
                  className="form-control"
                  aria-describedby="add-msg-help"
                  placeholder="add message..."
                  rows="5"/>
        <small id="add-msg-help" className="form-text text-muted">
          Add a new message to the conversation
        </small>
      </div>
      <div className="text-right">
        <button type="button"
                className="btn btn-primary"
                onClick={this.send_new_message}
                disabled={!Boolean(this.state.new_message)}>
          Send
        </button>
      </div>
    </div>
  }

  prts_change (v) {
    if (!v.participants) {
      return
    }
    const added_prts = v.participants.filter(x => !this.state.participants.includes(x))
    if (added_prts.length) {
      worker.postMessage({
        method: 'change_participants',
        args: {conv_key: this.state.conv.key, verb: 'add', participants: added_prts}
      })
    }

    const removed_prts = this.state.participants.filter(x => !v.participants.includes(x))
    if (removed_prts.length) {
      worker.postMessage({
        method: 'change_participants',
        args: {conv_key: this.state.conv.key, verb: 'delete', participants: removed_prts}
      })
    }
  }

  publish_draft () {
    const send = async () => {
      worker.postMessage({
        method: 'publish',
        args: {conv_key: this.props.conv_key}
      })
      this.setState({publish_allowed: false})
    }
    return <div className="box">
      <div className="text-right">
        <button type="button"
                className="btn btn-primary"
                onClick={send}
                disabled={!this.state.publish_allowed}>
          Send
        </button>
      </div>
    </div>
  }

  render () {
    if (this.state.conv_found === null) {
      return <div/>
    } else if (this.state.conv_found === false) {
      return <ConversationNotFound updateGlobal={this.props.updateGlobal} conv_key={this.props.conv_key}/>
    }
    return (
      <div className="row">
        <div className="col-9">
          {this.state.messages.map((msg, i) => (
            <div key={i}>
              <Message msg={msg} msg_actions={this.state.msg_actions} msg_heights={this.state.msg_heights}/>
            </div>
          ))}
          {this.state.conv.published ? this.add_message() : this.publish_draft()}
        </div>
        <div className="col-3">
          <div className="box">
            <Detail name="Created">{format_ts(this.state.conv.created_ts)}</Detail>
            <Detail name="Updated">{format_ts(this.state.conv.updated_ts)}</Detail>
            <Detail name="History">
              <Link to={`/${this.props.conv_key}/details`}>
                {this.state.action_count} actions
              </Link>
            </Detail>
          </div>
          <div className="box">
            <Participants selected={this.state.participants} onChange={this.prts_change}/>
            <small id="subject-help" className="form-text text-muted">
              Add and remove participants
            </small>
          </div>
        </div>
      </div>
    )
  }
}

export default ConversationDetails
