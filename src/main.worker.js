import {create_user_db} from './db'
import {urls, url_sub, get_json, post_json, now, ts2int} from './utils'

console.info('worker starting')

let CONNECTED = false
let db = null

function set_connected (c) {
  CONNECTED = c
  postMessage({method: 'update_global', state: {connected: c}})
}

let CONNECTED_AT = null
let LAST_COMMS = null
function set_connected_at () {
  CONNECTED_AT = now()
  postMessage({method: 'update_connected_at', connected_at: CONNECTED_AT})
}

function clear_connected_at () {
  CONNECTED_AT = null
  postMessage({method: 'update_connected_at', connected_at: CONNECTED_AT})
}

let WS_AUTH_URL
let DISCONNECTS = 0
let socket = null
function ws_connect(auto_close) {
  if (socket && socket.readyState !== socket.CLOSED) {
    if (auto_close) {
      socket.close()
    } else {
      console.log('ws already open')
      return
    }
  }
  // TODO: ws versions
  socket = new WebSocket(urls.ws)

  socket.onopen = () => {
    set_connected(true)
    console.log('websocket open')
    DISCONNECTS = 0
    set_connected_at()
    // if the connection hasn't been closed we're authenticated
    setTimeout(() => DISCONNECTS === 0 && postMessage({method: 'update_global', state: {authenticated: true}}), 200)
  }

  socket.onclose = async e => {
    DISCONNECTS += DISCONNECTS >= 30 ? 0 : 1
    let timeout = null
    clear_connected_at()
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
    } else if (data.key) {
      process_action(data)
    } else {
      console.log('unknown websocket:', e)
    }
  }
}

async function init () {
  db = await create_user_db()
  if (db) {
    postMessage({method: 'update_global', state: {local_data: true, user: db.user}})
  } else {
    postMessage({method: 'update_global', state: {local_data: false}})
  }
  ws_connect()
}

async function process_action (data) {
  console.log('processing action:', data)
  const conv_key = data.conv_key
  const new_conv = await db.transaction('r', db.convs, async () => !await db.convs.get(conv_key))
  if (new_conv) {
    await set_new_conv(conv_key)
  } else {
    await apply_action(data)
    await update_conv_meta(conv_key, data)
  }
  postMessage({method: 'conv', conv_key: conv_key})
}

async function apply_action (data) {
  if (!db) {
    console.warn('apply_action: no local db connected')
    return
  }
  LAST_COMMS = now()
  data.timestamp = ts2int(data.timestamp)
  if (data.item) {
    data[data.component] = data.item
    delete data.item
  }
  // console.log('applying action:', data)

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
      await db.convs.update(data.conv_key, {published: true})
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

function prepare_conv (conv_details) {
  conv_details.snippet = JSON.stringify(conv_details.snippet)
  conv_details.updated_ts = ts2int(conv_details.updated_ts)
  conv_details.created_ts = ts2int(conv_details.created_ts)
  return conv_details
}

async function update_convs () {
  if (CONNECTED === false) {
    return
  }
  if (LAST_COMMS > CONNECTED_AT) {
    // up to date, don't get new messages
    return
  }
  const r = await get_json(urls.main.list, [200, 401])
  if (r.status === 200) {
    postMessage({method: 'update_global', state: {authenticated: true}})
    await db.transaction('rw', db.convs, async () => {
      for (let conv of r.json) {
        conv = prepare_conv(conv)
        let m = await db.convs.update(conv.key, conv)
        if (m === 0) {
          await db.convs.put(conv)
        }
      }
    }).catch(e => {console.error(e.stack || e)})
    postMessage({method: 'conv'})
    LAST_COMMS = now()
  } else if (r.status === 401) {
    postMessage({method: 'update_global', state: {authenticated: false}})
  }
}

async function update_single_conv (message) {
  const conv_key = message.data.conv_key
  const since_key = await db.transaction('r', db.convs, db.actions, async () => {
    if (await db.convs.get(conv_key)) {
      const last_action = (await db.actions.where({conv_key: conv_key}).reverse().sortBy('timestamp'))[0]
      return last_action && last_action.key
    }
  }).catch(e => {console.error(e.stack || e)})

  if (since_key){
    await apply_conv_actions(conv_key, since_key)
  } else {
    await set_new_conv(conv_key)
  }

  postMessage({method: 'conv', conv_key: conv_key})
}

async function apply_conv_actions (conv_key, since_key) {
  const r = await get_json(url_sub(urls.main.actions, {conv: conv_key}) + '?since=' + since_key)
  console.log('apply_conv_actions:', r.json)
  if (r.json.length === 0) {
    await db.transaction('rw', db.convs, async () => {
      await db.convs.update(conv_key, {last_comms: now()})
    }).catch(e => {console.error(e.stack || e)})
    return
  }

  for (let action of r.json) {
    action.conv_key = conv_key
    await apply_action(action)
  }
  const last_action = r.json[r.json.length - 1]
  await update_conv_meta(conv_key, last_action)
}

async function set_new_conv (conv_key) {
  const r = await get_json(urls.main.get.replace('{conv}', conv_key))
  console.log('set_new_conv:', r.json)

  const conv_details = prepare_conv(r.json.details)
  conv_details.last_comms = now()
  let position = 0
  await db.transaction('rw', db.convs, db.messages, db.actions, db.participants, async () => {
    await db.convs.put(conv_details)
    for (let msg of r.json.messages) {
      msg.conv_key = conv_key
      position += 1  // TODO switch to proper position array
      msg.position = position
      await db.messages.put(msg)
    }
    for (let action of (r.json.actions || [])) {
      action.conv_key = conv_key
      action.timestamp = ts2int(action.timestamp)
      await db.actions.put(action)
    }
    for (let prt of (r.json.participants || [])) {
      await db.participants.put({
        address: prt.address,
        conv_key: conv_key,
      })
    }
  }).catch(e => {console.error(e.stack || e)})
}

async function update_conv_meta (conv_key, action) {
  await db.transaction('rw', db.convs, db.messages, db.participants, async () => {
    await db.convs.update(conv_key, {
      updated_ts: action.timestamp,
      last_comms: now(),
      snippet: JSON.stringify({
        addr: action.actor,
        body: action.body && action.body.substr(0, 20),
        comp: action.component,
        msgs: await db.messages.where({conv_key: conv_key}).count(),
        prts: await db.participants.where({conv_key: conv_key}).count(),
        verb: action.verb,
      }),
    })
  }).catch(e => {console.error(e.stack || e)})
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
  await db.transaction('rw', db.convs, db.messages, db.participants, db.actions, async () => {
    const conv = await db.convs.get(message.data.args.conv_key)
    conv.key = new_conv_key
    conv.old_key = message.data.args.conv_key
    await db.convs.add(conv)
    await db.convs.delete(conv.old_key)
    await db.messages.where({conv_key: conv.old_key}).modify({conv_key: new_conv_key})
    await db.participants.where({conv_key: conv.old_key}).modify({conv_key: new_conv_key})
    await db.actions.where({conv_key: conv.old_key}).modify({conv_key: new_conv_key})
  }).catch(e => {console.error(e.stack || e)})
  postMessage({method: 'conv', conv_key: message.data.args.conv_key})
  postMessage({method: 'conv', conv_key: new_conv_key})
}
