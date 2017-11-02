import db from './db'
console.info('worker starting')

const env = process.env  // eslint-disable-line no-undef
// const login_url = env.REACT_APP_AUTH_URL + '/login/'
const list_url = env.REACT_APP_MAIN_URL + '/list/'

async function init() {
  let r
  try {
    r = await fetch(list_url)
  } catch (e) {
    console.error('fetch error:', e)
    return
  }
  console.log('request:', r)
  if (r.status === 200) {

    const data = await r.json()
    console.log(data)
    db.transaction('rw', db.convs, async () => {
      //
    })
  } else if (r.status === 401) {
    console.log('needs to login')
    postMessage({method: 'update_global', state: {authenticated: false}})
  } else {
    console.error('request error:', r)
  }
}

init()


const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
function rand (len) {
  let text = ''
  len = len || 10

  for (let i = 0; i < len; i++){
    text += ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length))
  }

  return text
}

const METHODS = [
  create_conv,
  add_message,
  login,
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

async function create_conv (message) {
  const conv_data = message.data.args

  // TODO send to server
  conv_data.key = 'dft-' + rand()
  conv_data.snippet = conv_data.body.substr(0, 20)
  conv_data.create = (new Date()).getTime()
  conv_data.last_updated = conv_data.create
  console.log(conv_data)

  const message_data = {
    key: 'msg-' + rand(),
    conv_key: conv_data.key,
    position: 1,
    body: conv_data.body,
  }

  db.transaction('rw', db.convs, db.messages, async () => {
    await db.convs.add(conv_data)
    await db.messages.add(message_data)
    postMessage({method: 'conv_list'})
    postMessage({method: 'conv', conv_key: conv_data.key})
  }).catch(e => {
    console.error(e.stack || e)
  })
}

async function add_message (message) {
  // TODO send to server
  const message_data = {
    key: 'msg-' + rand(),
    conv_key: message.data.args.conv_key,
    position: message.data.args.position,
    body: message.data.args.body,
  }

  db.transaction('rw', db.messages, async () => {
    await db.messages.add(message_data)
    postMessage({method: 'conv', conv_key: message_data.conv_key})
  }).catch(e => {
    console.error(e.stack || e)
  })
}

function login (message) {
  postMessage({method: 'update_global', state: {authenticated: true}})
}
