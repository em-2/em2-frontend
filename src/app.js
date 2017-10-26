import React, { Component } from 'react'
import {BrowserRouter as Router, Switch, Route, Link} from 'react-router-dom'
import {Typeahead} from 'react-bootstrap-typeahead'
import 'react-bootstrap-typeahead/css/Typeahead.css'
import Worker from './main.worker.js'
import db from './db'

const worker = Worker()

class ConversationList extends Component {
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


class ConversationDetails extends Component {
  // constructor(props) {
  //   super(props)
  // }

  async componentDidMount () {
    this.props.updateGlobal({
      page_title: this.props.conv,
      nav_title: this.props.conv,
    })
  }

  render () {
    return (
      <div>
        conv: {this.props.conv}
      </div>
    )
  }
}


class ConversationCreate extends Component {
  constructor(props) {
    super(props)
    this.state = {
      subject: '',
      body: '',
      participants: [],
    }
    this.handle_change = this.handle_change.bind(this)
    this.handle_prt_change = this.handle_prt_change.bind(this)
  }

  handle_change(event) {
    this.setState({[event.target.name]: event.target.value})
    if (event.target.name === 'subject') {
      this.props.updateGlobal({
        nav_title: event.target.value || 'New Conversation',
      })
    }
  }

  handle_prt_change (v) {
    this.handle_change(
        {
          target: {
            name: 'participants',
            value: v
          }
        }
    )
  }

  componentDidMount () {
    this.props.updateGlobal({
      page_title: 'New Conversation',
      nav_title: 'New Conversation',
    })
  }

  render () {
    // TODO should this be the same as viewing/editing a conversation?
    const unsavable = !(this.state.subject && this.state.body)
    let button_title = null
    if (unsavable) {
      button_title = 'Both subject and body must be set to save or send'
    }
    const options = [
      'anne@example.com',
      'ben@example',
      'charlie@example.com',
    ]
    return (
      <div className="row">
        <div className="col-8">
          <div className="form-group">
            <input type="text"
                   name="subject"
                   onChange={this.handle_change}
                   className="form-control"
                   aria-describedby="subject-help"
                   placeholder="Subject"/>
            <small id="subject-help" className="form-text text-muted">
              Conversation Subject.
            </small>
          </div>
          <div className="form-group">
            <textarea type="text"
                      name="body"
                      onChange={this.handle_change}
                      className="form-control"
                      aria-describedby="body-help"
                      placeholder="body"
                      rows="5"/>
            <small id="body-help" className="form-text text-muted">
              The first message in this conversation.
            </small>
          </div>

          <div className="btn-group pull-right" role="group" aria-label="Save or Send">
            <button type="button" className="btn btn-secondary" disabled={unsavable} title={button_title}>
              Save Draft
            </button>
            <button type="button" className="btn btn-primary" disabled={unsavable} title={button_title}>
              Send
            </button>
          </div>
        </div>
        <div className="col">
          <Typeahead
            multiple={true}
            options={options}
            onChange={this.handle_prt_change}
            allowNew
            newSelectionPrefix="New address:"
            placeholder="Add Participants..."
          />
        </div>
      </div>
    )
  }
}



class App extends Component {
  constructor(props) {
    super(props)
    this.updateGlobal = this.updateGlobal.bind(this)
    this.state = {
      page_title: null,
      nav_title: '',
    }
  }

  updateGlobal (new_state) {
    this.setState(new_state)
  }

  componentDidUpdate () {
    let next_title
    if (this.state.page_title) {
      next_title = 'em2 - ' + this.state.page_title
    } else {
      next_title = 'em2'
    }
    if (next_title !== document.title) {
      document.title = next_title
    }
  }

  render () {
    return (
      <Router>
        <div>
          <div key="navbar" className="fixed-top">
            <nav className="navbar navbar-expand-md navbar-light bg-light">
              <div className="container">
                <Link to="/" className="navbar-brand">em2</Link>
                <div className="collapse navbar-collapse">
                  <ul className="navbar-nav mr-auto">
                    <li className="nav-item">
                      <Link to="/create" className="nav-link">
                        <i className="fa fa-bolt mr-1" aria-hidden="true"/>
                        Create Conversation
                      </Link>
                    </li>
                    <li className="nav-item">
                      <a className="nav-link" href="/">
                        <i className="fa fa-cog mr-1" aria-hidden="true"/>
                        Settings
                      </a>
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
                {this.state.nav_title}
              </div>
            </div>
          </div>
          <main key="main" className="container">
            <div className="content">
              <Switch>
                <Route exact path="/" render={props => (
                  <ConversationList updateGlobal={this.updateGlobal} />
                )}/>

                <Route exact path="/create" render={props => (
                  <ConversationCreate updateGlobal={this.updateGlobal} />
                )}/>

                <Route exact path="/:conv" render={props => (
                  <ConversationDetails conv={props.match.params.conv} updateGlobal={this.updateGlobal} />
                )}/>
              </Switch>
            </div>
          </main>
        </div>
      </Router>
    )
  }
}

export default App
