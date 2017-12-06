import React, { Component } from 'react'
import {Typeahead, Token} from 'react-bootstrap-typeahead'
import isEmail from 'validator/lib/isEmail'
import {create_user_db} from "./db"

const get_prt_address = p => p.customOption ? p.label : p

class Participants extends Component {
  constructor (props) {
    super(props)
    this.state = {
      options: [],
    }
    this.handle_change = this.handle_change.bind(this)
    this.render_addr_token = this.render_addr_token.bind(this)
  }

  componentDidMount () {
    this.get_participants()
  }

  async get_participants () {
    this.db = this.db || await create_user_db()
    this.db && this.db.transaction('r', this.db.participants, async () => {
      const options = await this.db.participants.limit(50).toArray()
      this.setState({options: [...new Set(options.map(v => v.address))]})
    })
  }

  handle_change (v) {
    const addresses = v.map(get_prt_address)
    this.props.onChange && this.props.onChange({
      participants: addresses,
      participants_valid: addresses.every(v => isEmail(v))
    })
  }

  render_addr_token (option, onRemove, idx) {
    const addr = get_prt_address(option)
    return (
      <Token
        key={idx}
        className={isEmail(addr) ? '' : 'invalid'}
        onRemove={() => onRemove(addr)}>
        {addr}
      </Token>
    )
  }

  render () {
    return [
      <h4 key="t">Participants</h4>,
      <Typeahead
        key="rbt"
        selected={this.props.selected || []}
        multiple={true}
        options={this.state.options}
        onChange={this.handle_change}
        onInputChange={v => this.props.onChange && this.props.onChange({participants_clean: !v})}
        renderToken={this.render_addr_token}
        allowNew
        newSelectionPrefix="Add: "
        placeholder="Add Participants..."
        emptyLabel="Enter any email address"
      />
    ]
  }
}

export default Participants
