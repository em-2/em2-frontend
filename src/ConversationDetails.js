import React, { Component } from 'react'
import db from './db'
import {worker} from './shared'

class ConversationDetails extends Component {
  constructor(props) {
    super(props)
    this.state = {conv: {}}
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
    db.transaction('r', db.convs, async () => {
      const conv = await db.convs.get(this.props.conv_key)
      console.log('got conv', conv)
      this.setState(
          {conv: conv}
      )
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
      <div>
        conv: {this.props.conv_key}
      </div>
    )
  }
}

export default ConversationDetails
