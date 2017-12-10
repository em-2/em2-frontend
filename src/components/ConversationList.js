import React, { Component } from 'react'
import {Link} from 'react-router-dom'
import {create_user_db} from '../db'
import worker from '../worker'
import {now, format_ts} from '../utils'

window.last_update_convs = null


const ListItem = props => {
  const conv = props.conv
  const snippet = JSON.parse(conv.snippet)
  // TODO include read notifications, popovers, use first name not addr
  return <Link to={`/${conv.key}`}>
    <span className="subject">{conv.subject}</span>
    <span className="body">
      {snippet.addr === props.user.address ? '' : snippet.addr + ':'} {snippet.body}
      {/*<small>{conv.snippet}</small>*/}
    </span>


    <span className="float-right">
      <span className="icon">
        <i className="fa fa-comments" aria-hidden="true"/>{snippet.msgs}
      </span>
      <span className="icon">
        <i className="fa fa-users" aria-hidden="true"/>{snippet.prts}
      </span>
      <span>
        {format_ts(conv.updated_ts)}
      </span>
    </span>
  </Link>
}

class ConversationList extends Component {
  constructor (props) {
    super(props)
    this.state = {convs: []}
    this.db = null
  }

  componentDidMount () {
    this._ismounted = true
    this.update_list()
    this.listener_id = worker.add_listener('conv', () => this.update_list())
    if (!window.last_update_convs || window.last_update_convs <= window.connected_at) {
      window.last_update_convs = now()
      worker.postMessage({method: 'update_convs'})
    }
  }

  componentWillUnmount () {
    this._ismounted = false
    worker.remove_listener(this.listener_id)
  }

  async update_list () {
    this.db = this.db || await create_user_db()
    this.db && this.db.transaction('r', this.db.convs, async () => {
      const convs = await this.db.convs.orderBy('updated_ts').reverse().limit(5).toArray()
      if (this._ismounted) {
        this.setState(
          {convs: convs}
        )
        this.props.updateGlobal({
          page_title: null,
          nav_title: `${convs.length} Conversations`,
        })
      }
    })
  }

  render () {
    // TODO need a loading icon if convs. haven't yet been loaded
    return (
      <div className="box-list conv-list">
        {/* labels */}
        {this.state.convs.map((conv, i) => (
          <div key={i}>
            <ListItem conv={conv} user={this.props.user}/>
          </div>
        ))}
      </div>
    )
  }
}

export default ConversationList
