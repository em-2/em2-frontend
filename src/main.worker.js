import db from './db'
import {urls, url_sub, get_json, post_json} from './utils'

console.info('worker starting')

let WS_OPEN = false
let CONNECTED = false
let WS_AUTH_URL

function set_connected (c) {
  postMessage({method: 'update_global', state: {connected: c}})
  CONNECTED = c
}

function ws_connect() {
  if (WS_OPEN) {
    console.log('ws already open')
    return
  }
  WS_OPEN = true
  // TODO: ws versions
  const socket = new WebSocket(urls.ws)

  socket.onopen = () => {
    set_connected(true)
    console.log('websocket open')
  }

  socket.onclose = async e => {
    let timeout = null
    if (e.code === 1006) {
      console.log('websocket close, connection failed')
      set_connected(false)
      timeout = 3000
    } else if (e.code === 4401) {
      console.log('websocket close, authentication required')
      if (WS_AUTH_URL) {
        const r = await fetch(WS_AUTH_URL, {credentials: 'include'})
        if (r.status === 200) {
          timeout = 1000
        } else {
          console.error('unexpected response:', r)
        }
      }
    } else if (e.code === 4403) {
      console.log('websocket close, permission denied')
      postMessage({method: 'update_global', state: {authenticated: false}})
    } else {
      console.warn('unknown websocket close', e)
      set_connected(false)
      timeout = 5000
    }
    if (timeout) {
      // TODO slow this down on repeat fails to avoid excessive requests.
      setTimeout(ws_connect, timeout)
    }
  }

  socket.onmessage = e => {
    const data = JSON.parse(e.data)
    if (data.auth_url) {
      WS_AUTH_URL = data.auth_url
    } else if (data.action_key) {
      apply_action(data)
    } else {
      console.log('unknown websocket:', e)
    }
  }
  WS_OPEN = false
}

ws_connect()

async function apply_action (data) {
  // data = {
  //   action_key: 'act-r4725lqfp5jcwekc',
  //   conv_key: '04d5f14b1bd5dc73038c8a390b89b694e548f65a698b9e60938048f6351059f5',
  //   item: 'msg-lckqaas6uhu63y2c',
  //   timestamp: '2017-11-09T23:34:39.148000',
  //   actor: 'testing@imber.io',
  //   body: 'and again',
  //   component: 'message',
  //   msg_format: 'markdown',
  //   parent: 'act-dnu5jdmwg3lx6iwz',
  //   relationship: 'sibling',
  //   verb: 'add',
  // }
  console.log('applying action:', data)
  data.key = data.action_key
  delete data.action_key
  data.ts = ts2int(data.timestamp)
  delete data.ts
  data[data.component] = data.item
  delete data.item
  db.transaction('rw', db.actions, db.messages, async () => {
    // add makes sure we don't repeat actions
    await db.actions.add(data)
    const parent_action = await db.actions.get(data.parent)
    if (data.component === 'message') {
      const parent_message = await db.messages.get(parent_action.message)
      db.messages.put({
        key: data.message,
        conv_key: data.conv_key,
        body: data.body,
        deleted: false,
        format: data.msg_format,
        after: parent_message.key,
        position: parent_message.position + 1,
        relationship: data.relationship,
      })
    } else {
      console.error('dont know how to deal with', data)
    }
  }).catch(e => {console.error(e.stack || e)})
  postMessage({method: 'conv', conv_key: data.conv_key})
}

const METHODS = [
  ws_connect,
  update_convs,
  check_local,
  update_single_conv,
  add_message,
]

const METHOD_LOOKUP = {}
for (const f of METHODS) {
  METHOD_LOOKUP[f.name] = f
}

onmessage = function (message) { // eslint-disable-line no-undef
  const method = METHOD_LOOKUP[message.data.method]
  if (method === undefined) {
    console.error(`worker: method "${message.data.method}" not found`)
  } else {
    method(message)
  }
}

const ts2int = ts => (new Date(ts)).getTime()

function prepare_conv(conv_details){
  conv_details.snippet = JSON.stringify(conv_details.snippet)
  conv_details.updated_ts = ts2int(conv_details.updated_ts)
  conv_details.created_ts = ts2int(conv_details.created_ts)
  return conv_details
}

async function update_convs (message) {
  if (CONNECTED === false) {
    return
  }
  const r = await get_json(urls.main.list, [200, 401])
  if (r.status === 200) {
    postMessage({method: 'update_global', state: {authenticated: true}})
    db.transaction('rw', db.convs, async () => {
      for (let conv of r.json) {
        await db.convs.put(prepare_conv(conv))
      }
    })
    postMessage({method: 'conv_list'})
  } else if (r.status === 401) {
    postMessage({method: 'update_global', state: {authenticated: false}})
  }
}

async function check_local () {
  db.transaction('r', db.convs, async () => {
    const conv_count = await db.convs.count()
    if (conv_count > 0) {
      postMessage({method: 'update_global', state: {local_data: true}})
    }
  })
}

async function update_single_conv (message) {
  const r = await get_json(urls.main.get.replace('{conv}', message.data.conv_key))

  // console.log('update_single_conv', r.json)
  const conv_details = prepare_conv(r.json.details)
  let position = 0
  db.transaction('rw', db.convs, db.messages, db.actions, async () => {
    await db.convs.put(conv_details)
    for (let msg of r.json.messages) {
      msg.conv_key = conv_details.key
      position += 1  // TODO switch to proper position array
      msg.position = position
      await db.messages.put(msg)
    }
    for (let action of r.json.actions) {
      action.conv_key = conv_details.key
      action.ts = ts2int(action.ts)
      await db.actions.put(action)
    }
    // TODO add participants and actions
  }).catch(e => {console.error(e.stack || e)})
  postMessage({method: 'conv_list'})
  postMessage({method: 'conv', conv_key: conv_details.key})
}

async function add_message (message) {
  const url = url_sub(urls.main.act, {conv: message.data.args.conv_key, component: 'message', verb: 'add'})

  let newest_action
  await db.transaction('r', db.actions, async () => {
    const actions = await db.actions.where({message: message.data.args.msg_key}).toArray()

    for (let action of actions) {
      if (!newest_action || action.ts > newest_action.ts) {
        newest_action = action
      }
    }
  }).catch(e => console.error(e.stack || e))

  post_json(url, {
    body: message.data.args.body,
    parent: newest_action.key
  })
}
