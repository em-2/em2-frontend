import React, { Component } from 'react'
import {BrowserRouter as Router, Switch, Route, Link} from 'react-router-dom'
import 'react-bootstrap-typeahead/css/Typeahead.css'
import ConversationCreate from './ConversationCreate'
import ConversationDetails from './ConversationDetails'
import ConversationList from './ConversationList'
import Settings from './Settings'


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
                      <Link to="/settings" className="nav-link">
                        <i className="fa fa-cog mr-1" aria-hidden="true"/>
                        Settings
                      </Link>
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
                  <ConversationList updateGlobal={this.updateGlobal} history={props.history} />
                )}/>

                <Route exact path="/create" render={props => (
                  <ConversationCreate updateGlobal={this.updateGlobal} history={props.history}/>
                )}/>

                <Route exact path="/settings" render={props => (
                  <Settings updateGlobal={this.updateGlobal}/>
                )}/>

                <Route exact path="/:conv" render={props => (
                  <ConversationDetails conv_key={props.match.params.conv} updateGlobal={this.updateGlobal} />
                )}/>

                <Route render={props => (
                  <div>
                    <h3>Page not found</h3>
                  </div>
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
