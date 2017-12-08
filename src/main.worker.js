import {create_user_db} from './db'
import {urls, url_sub, get_json, post_json, now, ts2int} from './utils'

console.info('worker starting')

function window_trigger (method, args) {
  postMessage({method: method, args: args})
}

let CONNECTED = false
let db = null

function set_connected (c) {
  CONNECTED = c
  window_trigger('update_global', {connected: c})
}

let CONNECTED_AT = null
let LAST_COMMS = null
function set_connected_at () {
  CONNECTED_AT = now()
  window_trigger('update_connected_at', {connected_at: CONNECTED_AT})
}

function clear_connected_at () {
  CONNECTED_AT = null
  window_trigger('update_connected_at', {connected_at: CONNECTED_AT})
}

let WS_AUTH_URL
let DISCONNECTS = 0
let socket = null
function ws_connect (auto_close) {
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
    setTimeout(() => DISCONNECTS === 0 && window_trigger('update_global', {authenticated: true}), 200)
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
      window_trigger('update_global', {authenticated: false})
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
    window_trigger('update_global', {local_data: true, user: db.user})
  } else {
    window_trigger('update_global', {local_data: false})
  }
  ws_connect()
}

const FULL_UPDATE = 'full-update'

async function process_action (data) {
  console.log('processing action:', data)
  const conv_key = data.conv_key
  const run_actions = await db.transaction('rw', db.actions, db.messages, db.participants, db.convs, async () => {
    if (await db.convs.get(conv_key)) {
      const s = await apply_action(data)
      if (s !== FULL_UPDATE) {
        await update_conv_meta(conv_key, data)
        return false
      }
    }
    return true
  }).catch(e => {console.error(e.stack,  e)})

  if (run_actions) {
    await apply_conv_actions(conv_key)
  }
  window_trigger('conv', {conv_key: conv_key, from: 'process_action'})
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
  const parent_action = data.parent && await db.actions.get(data.parent)
  if (data.parent && !parent_action) {
    // we don't have the parent action no point in proceeding
    console.log('no parent, not proceeding', data)
    return data.verb === 'publish' && FULL_UPDATE
  }

  try {
    await db.actions.add(data)
  } catch (e) {
    if (e.name === 'ConstraintError') {
      // this happens when two clients are connected at the same time
      console.log('action already exists')
    } else {
      console.error('error:', e)
    }
    return
  }

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
      updated_ts: data.timestamp,
      body: data.body,
      deleted: false,
      format: data.msg_format,
      after: parent_message ? parent_message.key : null,
      position: parent_message ? parent_message.position + 1 : 0,
      relationship: data.relationship,
    })
  } else if (data.component === 'participant') {
    const prt_data = {conv_key: data.conv_key, address: data.participant}
    if (data.verb === 'add') {
      await db.participants.put(prt_data)
    } else if (data.verb === 'delete') {
      await db.participants.where(prt_data).delete()
    }
  } else if (data.verb === 'publish') {
    await db.convs.update(data.conv_key, {published: true})
  } else if (data.verb === 'create') {
    await create_conv_from_action(data, false)
  } else if (data.component === 'subject') {
    await db.convs.update(data.conv_key, {subject: data.body})
  } else {
    console.error('dont know how to deal with', data)
  }
}

async function create_conv_from_action (data, published) {
  await db.convs.put({
    key: data.conv_key,
    subject: data.body,
    updated_ts: data.timestamp,
    created_ts: data.timestamp,
    published: published,
  })
}

const METHODS = [
  init,
  ws_connect,
  update_convs,
  update_single_conv,
  add_message,
  change_participants,
  publish,
  nav_title_change,
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
    console.log('worker running:', message.data.method, message.data.args || '')
    method(message.data.args)
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
    window_trigger('update_global', {authenticated: true})
    await db.transaction('rw', db.convs, async () => {
      for (let conv of r.json) {
        conv = prepare_conv(conv)
        let m = await db.convs.update(conv.key, conv)
        if (m === 0) {
          await db.convs.put(conv)
        }
      }
    }).catch(e => {console.error(e.stack,  e)})
    window_trigger('conv')
    LAST_COMMS = now()
  } else if (r.status === 401) {
    window_trigger('update_global', {authenticated: false})
  }
}

async function update_single_conv (args) {
  const conv_key = args.conv_key

  const since_key = await db.transaction('rw', db.actions, db.messages, db.participants, db.convs, async () => {
    const last_action = (await db.actions.where({conv_key: conv_key}).reverse().sortBy('timestamp'))[0]
    return last_action && last_action.key
  }).catch(e => {console.error(e.stack,  e)})

  await apply_conv_actions(conv_key, since_key)

  window_trigger('conv', {conv_key: conv_key, from: 'update_single_conv'})
}

async function apply_conv_actions (conv_key, since_key) {
  let url = url_sub(urls.main.get, {conv: conv_key})
  if (since_key) {
    url += '?since=' + since_key
  }
  const r = await get_json(url)
  console.log('apply_conv_actions:', r.json)
  await db.transaction('rw', db.actions, db.messages, db.participants, db.convs, async () => {
    if (r.json.length === 0) {
      await db.convs.update(conv_key, {last_comms: now()})
      return
    }
    if (!await db.convs.get(conv_key)) {
      console.log('apply_conv_actions, new conv')
      const action = r.json[0]
      action.conv_key = conv_key
      await create_conv_from_action(action, false)
    }

    for (let action of r.json) {
      action.conv_key = conv_key
      await apply_action(action)
    }
    const last_action = r.json[r.json.length - 1]
    await update_conv_meta(conv_key, last_action)
  }).catch(e => {console.error(e.stack,  e)})
}

const SNIPPET_BODY_SIZE = 100

async function snippet_body (conv_key, action) {
  if (action.component === 'message' && action.body) {
    return action.body.substr(0, SNIPPET_BODY_SIZE)
  } else {
    const msgs = await db.messages.where({conv_key: conv_key}).reverse().sortBy('update_ts')
    return msgs[0].body.substr(0, SNIPPET_BODY_SIZE)
  }
}

async function update_conv_meta (conv_key, action) {
  await db.convs.update(conv_key, {
    updated_ts: action.timestamp,
    last_comms: now(),
    snippet: JSON.stringify({
      addr: action.actor,
      body: await snippet_body(conv_key, action),
      comp: action.component,
      msgs: await db.messages.where({conv_key: conv_key}).count(),
      prts: await db.participants.where({conv_key: conv_key}).count(),
      verb: action.verb,
    }),
  })
}

async function add_message (args) {
  const url = url_sub(urls.main.act, {conv: args.conv_key, component: 'message', verb: 'add'})

  let newest_action
  const set_newest_action = actions => {
    for (let action of actions) {
      if (!newest_action || action.ts > newest_action.ts) {
        newest_action = action
      }
    }
  }
  await db.transaction('r', db.actions, async () => {
    const msg_actions = await db.actions.where({message: args.msg_key}).toArray()
    set_newest_action(msg_actions)
    if (!newest_action) {
      // maybe need to filter on verb == publish here too
      const conv_actions = await db.actions.where({conv_key: args.conv_key}).toArray()
      set_newest_action(conv_actions)
    }
  }).catch(e => console.error(e.stack,  e))

  if (newest_action) {
    await post_json(url, {
      body: args.body,
      parent: newest_action.key
    })
  } else {
    console.error('no newest_action')
  }
}

async function change_participants (args) {
  const url = url_sub(urls.main.act, {conv: args.conv_key, component: 'participant', verb: args.verb})

  for (let prt of args.participants) {
    post_json(url, {item: prt})
  }
}

async function publish (args) {
  const r = await post_json(url_sub(urls.main.publish, {conv: args.conv_key}))
  const new_conv_key = r.json.key
  await db.transaction('rw', db.convs, db.messages, db.participants, db.actions, async () => {
    const conv = await db.convs.get(args.conv_key)
    conv.key = new_conv_key
    conv.old_key = args.conv_key
    await db.convs.add(conv)
    await db.convs.delete(conv.old_key)
    await db.messages.where({conv_key: conv.old_key}).delete()
    await db.participants.where({conv_key: conv.old_key}).delete()
    await db.actions.where({conv_key: conv.old_key}).delete()
  }).catch(e => {console.error(e, e.stack)})
  window_trigger('conv', {conv_key: args.conv_key, from: 'publish'})
}

async function nav_title_change (args) {
  const parent_key = await db.transaction('r', db.actions, async () => {
    const actions = await db.actions.where({conv_key: args.conv_key}).reverse().sortBy('timestamp')
    for (let action of actions) {
      if (action.component === 'subject' || action.verb === 'publish' || action.verb === 'create') {
        return action.key
      }
    }
  }).catch(e => console.error(e.stack,  e))

  const url = url_sub(urls.main.act, {conv: args.conv_key, component: 'subject', verb: 'modify'})
  await post_json(url, {
    body: args.title,
    parent: parent_key
  })
}
