import React, { Component } from 'react'
import {Redirect} from 'react-router-dom'
import {urls, post_json, get_json} from './utils'
import {update_meta_db} from './db'
import worker from './worker'

class Login extends Component {
  constructor(props) {
    super(props)
    this.state = {
      email: '',
      password: '',
      submit_disabled: false,
      captcha_required: false,
      form_invalid: false,
    }
    this.handle_change = this.handle_change.bind(this)
    this.submit = this.submit.bind(this)
  }

  handle_change (event) {
    this.setState({[event.target.name]: event.target.value})
    if (event.target.name === 'subject') {
      this.props.updateGlobal({
        nav_title: event.target.value || 'New Conversation',
      })
    }
  }

  async submit (e) {
    if (this.state.email && this.state.password) {
      e.preventDefault()
      this.setState({submit_disabled: true, form_invalid: false})

      const payload = {address: this.state.email, password: this.state.password}
      const r = await post_json(urls.auth.login, payload, [200, 401, 429])

      if (r.status === 200) {
        await update_meta_db()
        worker.postMessage({method: 'init'})
        this.props.updateGlobal({authenticated: true})
      } else if (r.status === 401) {
        this.setState({
          form_invalid: true,
          captcha_required: r.json.captcha_required,
          submit_disabled: false,
          password: ''
        })
      } else {
        // 429
        this.setState({form_invalid: true, captcha_required: true, submit_disabled: false})
      }
    }
  }

  async componentDidMount () {
    this.props.updateGlobal({
      page_title: 'Login',
      nav_title: 'Login',
    })
    const r = await get_json(urls.auth.login)
    this.setState({captcha_required: r.json.captcha_required})
  }

  render () {
    if (this.props.authenticated) {
      return <Redirect to={{pathname: '/', state: { from: this.props.location }}}/>
    }
    const field_cls = this.state.form_invalid ? 'form-control is-invalid' : 'form-control'
    return (
      <div className="box">
        <form className="login">

          <label htmlFor="inputEmail" className="sr-only">Email address</label>
          <input type="email"
                 onChange={this.handle_change}
                 value={this.state.email}
                 name="email"
                 className={field_cls}
                 placeholder="Email address"
                 required={true}/>

          <label htmlFor="inputPassword" className="sr-only">Password</label>
          <input type="password"
                 onChange={this.handle_change}
                 value={this.state.password}
                 name="password"
                 className={field_cls}
                 placeholder="Password"
                 required={true}/>

          <div className="invalid-feedback">
            Email or password invalid, note both fields are case-sensitive.
          </div>

          {this.state.captcha_required &&
            <p>
              TODO captcha required!
            </p>
          }

          <button type="submit"
                  className="btn btn-primary btn-block"
                  disabled={this.state.submit_disabled}
                  onClick={this.submit}>
            Log in
          </button>
        </form>
      </div>
    )
  }
}

export default Login
