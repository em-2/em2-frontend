import React, {Component} from 'react'

const Detail = props => (
  <div className="detail">
    <label>{props.name}</label>
    <div>{props.children}</div>
  </div>
)

class ConversationNotFound extends Component {
  componentDidMount () {
    this.props.updateGlobal({
      page_title: 'Conversation not Found',
      nav_title: 'Conversation not Found',
    })
  }

  render () {
    return (
      <div className="box">
        <h3>Conversation not found</h3>
        <p>No record found of the conversation {this.props.conv_key.substr(0, 8)}.</p>
      </div>
    )
  }
}

export {
  Detail,
  ConversationNotFound,
}
