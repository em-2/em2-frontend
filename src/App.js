import React, { Component } from 'react'
import Worker from './main.worker.js'
import db from './db'

const worker = Worker()

class Conversations extends Component {
  constructor(props) {
    super(props)
    this.state = {convs: []}
  }

  async componentDidMount () {
    this.update_list()
    worker.onmessage = (e) => {
      if (e.data.event === 'convs') {
        this.update_list()
      }
    }
  }

  async update_list () {
    db.transaction('rw', db.convs, async () => {
      const convs = await db.convs.toArray()
      this.setState(
          {convs: convs}
      )
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
              <td>{conv.subject}</td>
              <td>{conv.snippet}</td>
              <td className="text-right">{conv.last_updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
}

const App = () => [
  <div key="navbar" className="fixed-top">
    <nav className="navbar navbar-expand-md navbar-light bg-light">
      <div className="container">
        <span className="navbar-brand">em2</span>
        <div className="collapse navbar-collapse">
          <ul className="navbar-nav mr-auto">
            <li className="nav-item">
              <a className="nav-link" href="/start">Start Conversation</a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/">Settings</a>
            </li>
          </ul>
          <form className="form-inline mt-2 mt-md-0">
            <input className="form-control" type="text" placeholder="Search" aria-label="Search"/>
          </form>
        </div>
      </div>
    </nav>
    <div className="nav2">
      <div className="container">
        hello
      </div>
    </div>
  </div>,
  <main key="main" className="container">
    <div className="content">
      <Conversations />
    </div>
  </main>
]


export default App
