import React, { Component } from 'react'
import db from './db'
import worker from './worker'

class ConversationDetails extends Component {
  constructor(props) {
    super(props)
    this.state = {
      conv: {},
      messages: [],
      new_message: '',
    }
    this.send_new_message = this.send_new_message.bind(this)
  }

  async componentDidMount () {
    const found_conv = await this.get_conv()
    if (found_conv) {
      // TODO some way to make sure the conv is up to date, maybe ok if ws is connected
      worker.postMessage({method: 'update_single_conv', conv_key: this.props.conv_key})
    } else {
      worker.postMessage({method: 'update_single_conv', conv_key: this.props.conv_key})
    }

    worker.add_listener('conv', e => {
      if (e.data.conv_key === this.state.conv.key) {
        const found_conv = this.get_conv()
        if (!found_conv) {
          console.log('TODO set "not found" message')
        }
      }
    })
  }

  async get_conv () {
    db.transaction('r', db.convs, db.messages, async () => {
      const conv = await db.convs.get(this.props.conv_key)
      if (!conv) {
        return false
      }
      const messages = await db.messages.where({conv_key: conv.key}).toArray()
      messages.sort((a, b) => a.position - b.position)
      this.setState({conv, messages})
      this.props.updateGlobal({
        page_title: conv.subject,
        nav_title: conv.subject,
      })
    }).catch(e => console.error(e.stack || e))
    return true
  }

  send_new_message () {
    worker.postMessage({
      method: 'add_message',
      args: {
        body: this.state.new_message,
        conv_key: this.state.conv.key,
        msg_key: this.state.messages[this.state.messages.length - 1].key
      }
    })
    this.setState({new_message: ''})
  }

  render () {
    return (
      <div className="row">
        <div className="col-8">
          {this.state.messages.map((msg, i) => (
            <div key={i} className="box">
              <div className="body">
                {msg.body}
              </div>
            </div>
          ))}
          <div className="box">
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
        </div>
        <div className="col-4">
          <div className="box">
            <p>Participants</p>
            {this.state.conv && this.state.conv.participants && this.state.conv.participants.map((p, i) => (
              <div key={i}>
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
}

export default ConversationDetails
