import React, { Component } from 'react'
import {Typeahead} from 'react-bootstrap-typeahead'
import {urls, post_json} from './utils'

async function create_conv (conv_data, publish) {
  // TODO manage offline case, conv needs to be saved and pending event added
  const r = await post_json(urls.main.create, conv_data)
  let conv_key = r.json.key
  if (publish) {
    const r2 = await post_json(urls.main.publish.replace('{conv}', conv_key))
    conv_key = r2.json.key
  }
  return conv_key
}

class ConversationCreate extends Component {
  constructor(props) {
    super(props)
    this.state = {
      subject: '',
      message: '',
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

  async save (publish) {
    const conv_key = await create_conv(this.state, publish)
    this.props.history.push('/' + conv_key)
  }

  render () {
    // TODO should this be the same as viewing/editing a conversation?
    const unsavable = !(this.state.subject && this.state.message)
    let button_title = null
    if (unsavable) {
      button_title = 'Both subject and message must be set to save or send'
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
            <textarea name="message"
                      onChange={this.handle_change}
                      className="form-control"
                      aria-describedby="message-help"
                      placeholder="message"
                      rows="5"/>
            <small id="message-help" className="form-text text-muted">
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
