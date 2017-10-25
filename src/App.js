import React, { Component } from 'react'
import './App.css'

class App extends Component {
  render () {
    return [
      <div className="fixed-top">
        <nav className="navbar navbar-expand-md navbar-light bg-light">
          <div className="container">
            <span className="navbar-brand">em2</span>
            <div className="collapse navbar-collapse">
              <ul className="navbar-nav mr-auto">
                <li className="nav-item active">
                  <a className="nav-link" href="/">Home <span className="sr-only">(current)</span></a>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="/">Link</a>
                </li>
                <li className="nav-item">
                  <a className="nav-link disabled" href="/">Disabled</a>
                </li>
              </ul>
              <form className="form-inline mt-2 mt-md-0">
                <input className="form-control mr-sm-2" type="text" placeholder="Search" aria-label="Search"/>
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
      <main className="container">
        <h3>body</h3>
        <p>content.</p>
      </main>
    ]
  }
}

export default App
