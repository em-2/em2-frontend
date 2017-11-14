import React, {Component} from 'react'
import {Link, Redirect, Route, Switch, withRouter} from 'react-router-dom'
import 'react-bootstrap-typeahead/css/Typeahead.css'
import ConversationCreate from './ConversationCreate'
import ConversationDetails from './ConversationDetails'
import ConversationList from './ConversationList'
import Settings from './Settings'
import Login from './Login'
import worker from './worker'


class _App extends Component {
  constructor(props) {
    super(props)
    this.updateGlobal = this.updateGlobal.bind(this)
    this.state = {
      page_title: null,
      nav_title: '',
      authenticated: null,
      connected: null,
      local_data: false,
      nav_class: '',
    }
    worker.add_listener('update_global', e => this.updateGlobal(e.data.state))
    this.render_nav_status = this.render_nav_status.bind(this)
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

  render_nav_status () {
    if (!this.state.connected) {
      return <span>Offline</span>
    } else if (!this.state.authenticated) {
      return <span>Connected - not authenticated</span>
    } else {
      return <span>Connected</span>
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
    const nav2_class = ['nav2']
    let nav_status = ''
    if (!this.state.connected) {
      nav2_class.push('offline')
      nav_status = 'Offline'
    } else if (!this.state.authenticated) {
      nav2_class.push('anon')
      nav_status = 'not authenticated'
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
        <div className={nav2_class.join(' ')}>
          <div className="back"/>
          <div className="container">
            {this.state.nav_title}
            <div className="pull-right">
              {nav_status}
            </div>
          </div>
        </div>
      </div>
      <main key="main" className="container">
        <div className="content">
          <Switch>
            <Route exact path="/" render={props => (
              <ConversationList updateGlobal={this.updateGlobal} history={props.history}/>
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

            <Route exact path="/:conv" render={props => (
              <ConversationDetails conv_key={props.match.params.conv}
                                   history={props.history}
                                   updateGlobal={this.updateGlobal}/>
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
  }
}

export default withRouter(_App)
