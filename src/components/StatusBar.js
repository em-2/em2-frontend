import React, {Component} from 'react'
import worker from '../worker'

class StatusBar extends Component {
  constructor (props) {
    super(props)
    this.state = {
      editing: false,
      nav_title: null
    }
    this.save_nav_title = this.save_nav_title.bind(this)
  }

  componentDidUpdate () {
    if (!this.state.editing && this.state.nav_title !== this.props.app_state.nav_title) {
      this.setState({nav_title: this.props.app_state.nav_title})
    }
    if (!this.props.app_state.nav_edit_arg && this.state.editing) {
      this.setState({editing: false})
    }
  }

  save_nav_title () {
    if (this.state.nav_title !== this.props.app_state.nav_title) {
      // techincally this is multipurpose until we use "conv_key", here, could change
      worker.trigger('nav_title_change', {title: this.state.nav_title, conv_key: this.props.app_state.nav_edit_arg})
    }
    this.setState({editing: false})
  }

  nav_title () {
    if (!this.props.app_state.nav_edit_arg) {
      return (
        <span>
          {this.props.app_state.nav_title}
        </span>
      )
    } else if (this.state.editing) {
      return (
        <span className="nav-title-edit">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              value={this.state.nav_title}
              onChange={e => this.setState({nav_title: e.target.value})}/>

            <span className="input-group-btn">
              <button
                className="btn btn-primary"
                type="button"
                onClick={this.save_nav_title}>
                <i className="fa fa-check" aria-hidden="true"/>
              </button>
            </span>
            <span className="input-group-btn">
              <button
                className="btn btn-light"
                type="button"
                onClick={() => this.setState({editing: false})}>
                <i className="fa fa-times" aria-hidden="true"/>
              </button>
            </span>
          </div>
        </span>
      )
    } else {
      return (
        <span>
          {this.props.app_state.nav_title}
          <i className="fa fa-pencil ml-2"
             onClick={() => {
               this.setState({editing: true})
             }}
             aria-hidden="true"/>
        </span>
      )
    }
  }

  render () {
    const nav2_class = ['nav2']
    let nav_status = ''
    const app_state = this.props.app_state
    if (!app_state.connected) {
      nav2_class.push('offline')
      nav_status = 'Offline'
    } else if (!app_state.authenticated) {
      nav2_class.push('anon')
      nav_status = 'not authenticated'
    }
    if (this.props.app_state.nav_edit_arg && this.state.editing) {
      nav2_class.push('editing')
    }
    return (
      <div className={nav2_class.join(' ')}>
        <div className="back"/>
        <div className="container">
          {this.nav_title()}
          <div className="pull-right">
            {nav_status}
            {app_state.user &&
            <span className="ml-2">
              <i className="fa fa-user-circle mr-1" aria-hidden="true"/>
              {app_state.user.address}
            </span>}
          </div>
        </div>
      </div>
    )
  }
}

export default StatusBar
