import {create_user_db} from './db'
import {urls, url_sub, get_json, post_json} from './utils'

console.info('worker starting')

let WS_OPEN = false
let CONNECTED = false
let DISCONNECTS = 0
let WS_AUTH_URL
let db = null

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
    DISCONNECTS = 0
    // if the connection hasn't been closed we're authenticated
    setTimeout(() => DISCONNECTS === 0 && postMessage({method: 'update_global', state: {authenticated: true}}), 100)
  }

  socket.onclose = async e => {
    WS_OPEN = false
    DISCONNECTS += DISCONNECTS >= 30 ? 0 : 1
    let timeout = null
    if (e.code === 1006) {
      console.log('websocket close, connection failed, disconnects:', DISCONNECTS)
      timeout = 2000
      // reconnnection failed, set offline
      setTimeout(() => DISCONNECTS !== 0 && set_connected(false), 3000)
    } else if (e.code === 4401) {
      console.log('websocket close, authentication required, disconnects:', DISCONNECTS)
      if (WS_AUTH_URL) {
        const r = await fetch(WS_AUTH_URL, {credentials: 'include'})
        if (r.status === 200) {
          timeout = 1000
        } else {
          console.error('unexpected response:', r)
        }
      }
    } else if (e.code === 4403) {
      console.log('websocket close, permission denied, disconnects:', DISCONNECTS)
      postMessage({method: 'update_global', state: {authenticated: false}})
    } else {
      console.warn('unknown websocket close', e)
      set_connected(false)
      timeout = 5000
    }
    if (timeout) {
      setTimeout(ws_connect, timeout * DISCONNECTS)
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
}

async function init () {
  db = await create_user_db()
  postMessage({method: 'update_global', state: {local_data: Boolean(db)}})
  ws_connect()
}

async function apply_action (data) {
  // TODO proper support if the previous message is missing
  console.log('applying action:', data)
  if (!db) {
    console.warn('apply_action: no local db connection available')
    return
  }
  data.key = data.action_key
  delete data.action_key
  data.ts = ts2int(data.timestamp)
  delete data.ts
  data[data.component] = data.item
  delete data.item
  await db.transaction('rw', db.actions, db.messages, db.convs, async () => {
    try {
      await db.actions.add(data)
    } catch (e) {
      if (e.name === 'ConstraintError') {
        // this happens when two clients are connected at the same time
        console.log('action already exists')
      } else {
        console.error('error:', e)
      }
      postMessage({method: 'conv', conv_key: data.conv_key})
      return
    }
    const parent_action = data.parent && await db.actions.get(data.parent)
    if (data.component === 'message') {
      let parent_message
      try {
        parent_message = parent_action && await db.messages.get(parent_action.message)
      } catch (e) {
        // console.warn('error getting parent message:', e)
      }
      if (!parent_message) {
        parent_message = (await db.messages.where({conv_key: data.conv_key}).reverse().sortBy('position'))[0]
      }
      await db.messages.put({
        key: data.message,
        conv_key: data.conv_key,
        body: data.body,
        deleted: false,
        format: data.msg_format,
        after: parent_message ? parent_message.key : null,
        position: parent_message ? parent_message.position + 1 : 0,
        relationship: data.relationship,
      })
    } else if (data.verb === 'publish') {
      await db.convs.update(data.conv_key, {'published': true})
    } else {
      console.error('dont know how to deal with', data)
    }
  }).catch(e => {console.error(e.stack || e)})
  postMessage({method: 'conv', conv_key: data.conv_key})
}

const METHODS = [
  init,
  ws_connect,
  update_convs,
  update_single_conv,
  add_message,
  publish,
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
    // console.log('onmessage:', message.data.method)
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
    await db.transaction('rw', db.convs, async () => {
      for (let conv of r.json) {
        await db.convs.put(prepare_conv(conv))
      }
    }).catch(e => {console.error(e.stack || e)})
    postMessage({method: 'conv_list'})
  } else if (r.status === 401) {
    postMessage({method: 'update_global', state: {authenticated: false}})
  }
}

async function update_single_conv (message) {
  let r
  try {
    r = await get_json(urls.main.get.replace('{conv}', message.data.conv_key))
  } catch (e) {
    console.warn('error:', e)
    postMessage({method: 'conv', conv_key: message.data.conv_key})
    return
  }


  // console.log('update_single_conv:', r.json)
  const conv_details = prepare_conv(r.json.details)
  let position = 0
  await db.transaction('rw', db.convs, db.messages, db.actions, async () => {
    await db.convs.put(conv_details)
    for (let msg of r.json.messages) {
      msg.conv_key = conv_details.key
      position += 1  // TODO switch to proper position array
      msg.position = position
      await db.messages.put(msg)
    }
    r.json.actions = r.json.actions || []
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
  const set_newest_action = actions => {
    for (let action of actions) {
      if (!newest_action || action.ts > newest_action.ts) {
        newest_action = action
      }
    }
  }
  await db.transaction('r', db.actions, async () => {
    const msg_actions = await db.actions.where({message: message.data.args.msg_key}).toArray()
    set_newest_action(msg_actions)
    if (!newest_action) {
      // maybe need to filter on verb == publish here too
      const conv_actions = await db.actions.where({conv_key: message.data.args.conv_key}).toArray()
      set_newest_action(conv_actions)
    }
  }).catch(e => console.error(e.stack || e))

  if (newest_action) {
    post_json(url, {
      body: message.data.args.body,
      parent: newest_action.key
    })
  } else {
    console.error('no newest_action')
  }
}

async function publish (message) {
  const r = await post_json(url_sub(urls.main.publish, {conv: message.data.args.conv_key}))
  const new_conv_key = r.json.key
  await db.transaction('rw', db.convs, db.messages, db.actions, async () => {
    const conv = await db.convs.get(message.data.args.conv_key)
    conv.key = new_conv_key
    conv.old_key = message.data.args.conv_key
    await db.convs.add(conv)
    await db.convs.delete(conv.old_key)
    await db.messages.where({conv_key: conv.old_key}).modify({conv_key: new_conv_key})
    await db.actions.where({conv_key: conv.old_key}).modify({conv_key: new_conv_key})
  }).catch(e => {console.error(e.stack || e)})
  postMessage({method: 'conv', conv_key: message.data.args.conv_key})
  postMessage({method: 'conv', conv_key: new_conv_key})
}
