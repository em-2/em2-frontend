import React, { Component } from 'react'
import {create_user_db} from './db'
import worker from './worker'
import format from 'date-fns/format'
import {now} from "./utils";

const DTF = 'HH:mm DD/MM/YYYY'
window.last_update_convs = null

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
      const convs = await this.db.convs.orderBy('updated_ts').reverse().limit(50).toArray()
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

  format_snippet (snippet_str) {
    const snippet = JSON.parse(snippet_str)
    return <span>
      {snippet.addr}: {snippet.body}<br/>
      <small>{snippet_str}</small>
    </span>
  }

  render () {
    // TODO need a loading icon if convs. haven't yet been loaded
    return (
      <div className="box-conv-list">
        <table className="table conv-list">
          <tbody>
            {this.state.convs.map((conv, i) => (
              <tr key={i} onClick={() => this.props.history.push(`/${conv.key}`)}>
                <td key="sub">{conv.subject}</td>
                <td key="sni">{this.format_snippet(conv.snippet)}</td>
                <td key="upd" className="text-right">{format(new Date(conv.updated_ts), DTF)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}

export default ConversationList
