import React, { Component } from 'react'
import db from './db'
import {worker} from './shared'

class ConversationDetails extends Component {
  constructor(props) {
    super(props)
    this.state = {
      conv: {},
      messages: []
    }
  }

  componentDidMount () {
    this.get_conv()
    worker.onmessage = (e) => {
      if (e.data.event === 'conv' && e.data.conv_key === this.state.conv.key) {
        this.get_conv()
      }
    }
  }

  async get_conv () {
    db.transaction('r', db.convs, db.messages, async () => {
      const conv = await db.convs.get(this.props.conv_key)
      const messages = await db.messages.where({conv_key: conv.key}).toArray()
      console.log('messages', messages)
      this.setState({conv, messages})
      this.props.updateGlobal({
        page_title: conv.subject,
        nav_title: conv.subject,
      })
    }).catch(e => {
      console.error(e.stack || e)
    })
  }

  render () {
    return (
      <div className="row">
        <div className="col-8">
          {this.state.messages.map((msg, i) => (
            <div key={i}>
              <div className="body">
                {msg.body}
              </div>
            </div>
          ))}
        </div>
        <div className="col">
          <p>Participants</p>
          {this.state.conv && this.state.conv.participants && this.state.conv.participants.map((p, i) => (
            <div key={i}>
              {p}
            </div>
          ))}
        </div>
      </div>
    )
  }
}

export default ConversationDetails
