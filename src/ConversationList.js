import React, { Component } from 'react'
import {Link} from 'react-router-dom'
import db from './db'
import {worker} from './shared'

class ConversationList extends Component {
  constructor(props) {
    super(props)
    this.state = {convs: []}
  }

  async componentDidMount () {
    this.update_list()
    worker.onmessage = (e) => {
      if (e.data.event === 'conv_list') {
        this.update_list()
      }
    }
  }

  async update_list () {
    db.transaction('r', db.convs, async () => {
      const convs = await db.convs.orderBy('last_updated').reverse().toArray()
      this.setState(
          {convs: convs}
      )
      this.props.updateGlobal({
        page_title: null,
        nav_title: `${convs.length} Conversations`,
      })
    }).catch(e => {
      console.error(e.stack || e)
    })
  }

  render () {
    // TODO need a loading icon if convs. haven't yet been loaded
    return (
      <table className="table convs">
        <tbody>
          {this.state.convs.map((conv, i) => (
            <tr key={i}>
              <td key="sub">
                <Link to={`/${conv.key}`}>{conv.subject}</Link>
                </td>
              <td key="sni">{conv.snippet}</td>
              <td key="upd" className="text-right">{conv.last_updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
}

export default ConversationList
