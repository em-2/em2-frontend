import React from 'react'

const StatusBar = props => {
  const nav2_class = ['nav2']
  let nav_status = ''
  const state = props.app_state
  if (!state.connected) {
    nav2_class.push('offline')
    nav_status = 'Offline'
  } else if (!state.authenticated) {
    nav2_class.push('anon')
    nav_status = 'not authenticated'
  }
  return (
    <div className={nav2_class.join(' ')}>
      <div className="back"/>
      <div className="container">
        {state.nav_title}
        <div className="pull-right">
          {nav_status}
          {state.user &&
            <span className="ml-2">
              <i className="fa fa-user-circle mr-1" aria-hidden="true"/>
              {state.user.address}
            </span>}
        </div>
      </div>
    </div>
  )
}

export default StatusBar
