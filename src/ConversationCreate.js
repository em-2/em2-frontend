import React, { Component } from 'react'
import {Typeahead} from 'react-bootstrap-typeahead'
import {worker} from './shared'

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
    this.save = this.save.bind(this)
  }

  handle_change (event) {
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

  save (send) {
    worker.postMessage({method: 'create_conv', args: this.state})
    this.props.history.push('/')
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
      <div className="row box">
        <div className="col-8">
          <div className="form-group">
            <input type="text"
                   name="subject"
                   onChange={this.handle_change}
                   className="form-control"
                   aria-describedby="subject-help"
                   placeholder="Subject"/>
            <small id="subject-help" className="form-text text-muted">
              Conversation subject
            </small>
          </div>
          <div className="form-group">
            <textarea name="body"
                      onChange={this.handle_change}
                      className="form-control"
                      aria-describedby="body-help"
                      placeholder="body"
                      rows="5"/>
            <small id="body-help" className="form-text text-muted">
              The first message in this conversation
            </small>
          </div>

          <div className="btn-group float-right" role="group" aria-label="Save or Send">
            <button type="button"
                    className="btn btn-secondary"
                    onClick={() => this.save(false)}
                    disabled={unsavable}
                    title={button_title}>
              Save Draft
            </button>
            <button type="button"
                    className="btn btn-primary"
                    onClick={() => this.save(true)}
                    disabled={unsavable}
                    title={button_title}>
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

export default ConversationCreate
