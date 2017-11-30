import React, { Component } from 'react'
import {create_user_db} from './db'
import worker from './worker'

class ConversationDetails extends Component {
  constructor(props) {
    super(props)
    this.state = {
      conv: {},
      messages: [],
      participants: [],
      new_message: '',
      publish_allowed: true,
    }
    this.send_new_message = this.send_new_message.bind(this)
    this.add_message = this.add_message.bind(this)
    this.publish_draft = this.publish_draft.bind(this)
    this.db = null
  }

  async componentDidMount () {
    this._ismounted = true
    const found_conv = await this.get_conv()
    // console.log('found_conv', found_conv)
    if (!found_conv || !found_conv.last_comms || found_conv.last_comms <= window.connected_at) {
      // conversation might be out of date, updating it
      worker.postMessage({method: 'update_single_conv', conv_key: this.props.conv_key})
    }

    this.listener_id = worker.add_listener('conv', async e => {
      if (e.data.conv_key === this.props.conv_key) {
        const found_conv = await this.get_conv()
        if (!found_conv) {
          console.log('TODO set "not found" message')
        }
      }
    })
  }

  componentWillUnmount () {
    this._ismounted = false
    worker.remove_listener(this.listener_id)
  }

  async get_conv () {
    this.db = this.db || await create_user_db()
    return await this.db.transaction('r', this.db.convs, this.db.messages, this.db.participants, async () => {
      let conv = await this.db.convs.get(this.props.conv_key)
      if (!conv) {
        conv = await this.db.convs.get({old_key: this.props.conv_key})
        if (conv) {
          this.props.history.push('/' + conv.key)
        } else {
          return null
        }
      }
      const messages = await this.db.messages.where({conv_key: conv.key}).toArray()
      messages.sort((a, b) => a.position - b.position)
      const participants = await this.db.participants.where({conv_key: conv.key}).toArray()

      if (this._ismounted) {
        this.setState({conv, messages, participants})
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
            <p>Participants</p>
            {this.state.conv && this.state.participants && this.state.participants.map((p, i) => (
              <div key={i}>
                {p.address}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
}

export default ConversationDetails
