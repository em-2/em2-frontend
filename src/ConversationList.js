import React, { Component } from 'react'
import db from './db'
import worker from './worker'
import format from 'date-fns/format'

const DTF = 'HH:mm DD/MM/YYYY'

class ConversationList extends Component {
  constructor(props) {
    super(props)
    this.state = {convs: []}
  }

  async componentDidMount () {
    this.update_list()
    worker.add_listener('conv_list', e => this.update_list())
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
      <div className="box-conv-list">
        <table className="table conv-list">
          <tbody>
            {this.state.convs.map((conv, i) => (
              <tr key={i} onClick={() => this.props.history.push(`/${conv.key}`)}>
                <td key="sub">{conv.subject}</td>
                <td key="sni">{conv.snippet}</td>
                <td key="upd" className="text-right">{format(new Date(conv.last_updated), DTF)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}

export default ConversationList
