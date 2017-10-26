import React, { Component } from 'react'


class Settings extends Component {
  async componentDidMount () {
    this.props.updateGlobal({
      page_title: 'Settings',
      nav_title: 'Settings',
    })
  }

  render () {
    return (
      <div>
        Settings
      </div>
    )
  }
}

export default Settings
