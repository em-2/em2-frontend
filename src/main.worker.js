import db from './db'
import {urls, get_json, post_json} from './utils'

console.info('worker starting')

// TODO: ws versions

async function init() {
  // TODO check auth before connecting or use custom code for failed authentication
  const socket = new WebSocket(urls.ws)
  socket.onopen = e => console.log('websocket open')
  socket.onclose = e => console.log('websocket closed', e)
  socket.onmessage = e => console.log('websocket message', e)
}

init()

const METHODS = [
  update_convs,
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

async function update_convs () {
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
async function update_single_conv (message) {
  const r = await get_json(urls.main.get.replace('{conv}', message.data.conv_key))

  console.log('update_single_conv', r.json)
  const conv_details = prepare_conv(r.json.details)
  let position = 0
  db.transaction('rw', db.convs, db.messages, db.actions, async () => {
    await db.convs.put(conv_details)
    for (let msg of r.json.messages) {
      msg.conv_key = conv_details.key
      position += 1
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
  const url = urls.main.act
    .replace('{conv}', message.data.args.conv_key)
    .replace('{component}', 'message')
    .replace('{verb}', 'add')

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
