import React, { Component } from 'react'
import {Redirect} from 'react-router-dom'
import {worker} from './shared'


class Login extends Component {
  async componentDidMount () {
    this.props.updateGlobal({
      page_title: 'Login',
      nav_title: 'Login',
    })
  }

  render () {
    if (this.props.authenticated) {
      return <Redirect to={{pathname: '/', state: { from: this.props.location }}}/>
    }
    return (
      <div className="box">

        <button type="button"
                className="btn btn-primary"
                onClick={() => worker.postMessage({method: 'login'})}>
          Login
        </button>
      </div>
    )
  }
}

export default Login
