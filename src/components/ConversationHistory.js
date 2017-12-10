import React, { Component } from 'react'
import {create_user_db} from '../db'
import worker from '../worker'
import {ConversationNotFound} from './Shared'
import {format_ts} from '../utils'

class ConversationHistory extends Component {
  constructor (props) {
    super(props)
    this.state = {
      conv: {},
      found: null,
      actions: null,
    }
    this.db = null
  }

  async componentDidMount () {
    this._ismounted = true
    await this.get_data()

    this.listener_id = worker.add_listener('conv', async args => {
      if (args.conv_key === this.props.conv_key) {
        this.get_data()
      }
    })
  }

  componentWillUnmount () {
    this._ismounted = false
    worker.remove_listener(this.listener_id)
  }

  async get_data () {
    this.db = this.db || await create_user_db()
    const db = this.db
    return await this.db.transaction('r', db.convs, db.actions, async () => {
      let conv = await db.convs.get(this.props.conv_key)
      if (!conv) {
        this._ismounted && this.setState({found: false})
        return null
      }
      const actions = await db.actions.where({conv_key: conv.key}).reverse().sortBy('timestamp')

      if (this._ismounted) {
        this.setState({conv, actions, found: true})
        this.props.updateGlobal({
          page_title: conv.subject,
          nav_title: conv.subject + (conv.published ? '' : ' (draft)'),
        })
      }
      return conv
    }).catch(e => console.error(e.stack || e))
  }

  render () {
    if (this.state.found === null) {
      return <div/>
    } else if (this.state.found === false) {
      return <ConversationNotFound updateGlobal={this.props.updateGlobal} conv_key={this.props.conv_key}/>
    }
    return (
      <div className="box-list">
        {this.state.actions.map((action, i) => (
          <div key={i} className="action-details">
            <div>{action.verb} {action.component}</div>
            <small>
              <div>{format_ts(action.timestamp)}</div>
              <pre><code>{JSON.stringify(action, null, 2)}</code></pre>
            </small>
          </div>
        ))}
      </div>
    )
  }
}

export default ConversationHistory
