import React, {Component} from 'react'
import {Link, Redirect, Route, Switch, withRouter} from 'react-router-dom'
import 'react-bootstrap-typeahead/css/Typeahead.css'
import ConversationCreate from './ConversationCreate'
import ConversationDetails from './ConversationDetails'
import ConversationHistory from './ConversationHistory'
import ConversationList from './ConversationList'
import StatusBar from './StatusBar'
import Settings from './Settings'
import Login from './Login'
import worker from '../worker'

worker.add_listener('update_connected_at', args => {
  window.connected_at = args.connected_at
})

class _App extends Component {
  constructor (props) {
    super(props)
    this.updateGlobal = this.updateGlobal.bind(this)
    this.state = {
      page_title: null,
      nav_title: '',
      nav_edit_arg: null,
      authenticated: null,
      connected: null,
      local_data: false,
      nav_class: '',
      user: null,
    }
    worker.add_listener('update_global', args => this.updateGlobal(args))
  }

  componentDidMount () {
    worker.postMessage({method: 'init'})
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
    if (this.state.authenticated === null && this.state.connected === null) {
      return <div className="text-center">
        Authenticating...
      </div>
    } else if (!this.state.connected && !this.state.local_data) {
      return <div className="text-center">
        No internet connection and no local data, so nothing much to show you. :-(
      </div>
    } else if (this.state.authenticated === false && this.props.location.pathname !== '/login') {
      return <Redirect to={{
        pathname: '/login',
        state: { from: this.props.location }
      }}/>
    }
    return <div>
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
        <StatusBar app_state={this.state}/>
      </div>
      <main key="main" className="container">
        <div className="content">
          <Switch>
            <Route exact path="/" render={props => (
              <ConversationList updateGlobal={this.updateGlobal} history={props.history} user={this.state.user}/>
            )}/>

            <Route exact path="/login" render={props => (
              <Login updateGlobal={this.updateGlobal}
                     authenticated={this.state.authenticated}
                     history={props.history}/>
            )}/>

            <Route exact path="/create" render={props => (
              <ConversationCreate updateGlobal={this.updateGlobal} history={props.history}/>
            )}/>

            <Route exact path="/settings" render={props => (
              <Settings updateGlobal={this.updateGlobal}/>
            )}/>

            <Route exact path="/:conv/details" render={props => (
              <ConversationHistory conv_key={props.match.params.conv}
                                   history={props.history}
                                   updateGlobal={this.updateGlobal}/>
            )}/>

            <Route exact path="/:conv" render={props => (
              <ConversationDetails conv_key={props.match.params.conv}
                                   history={props.history}
                                   updateGlobal={this.updateGlobal}/>
            )}/>

            <Route render={props => (
              <div className="box">
                <h3>Page not found</h3>
                <p>The page "{props.location.pathname}" doesn't exist.</p>
              </div>
            )}/>
          </Switch>
        </div>
      </main>
    </div>
  }
}

export default withRouter(_App)
