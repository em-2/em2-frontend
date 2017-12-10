import React, { Component } from 'react'
import {Link} from 'react-router-dom'
import {create_user_db} from '../db'
import worker from '../worker'
import {format_ts} from '../utils'
import Participants from './Participants'
import {Detail, ConversationNotFound} from './Shared'

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
      const action_count = await db.actions.where({conv_key: conv.key}).count()

      if (this._ismounted) {
        this.setState({conv, messages, participants, action_count, conv_found: true})
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
            <div key={i} className="box">
              <div className="body">
                {msg.body}
              </div>
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
