import db from './db'
console.info('worker starting')

onmessage = function (message) { // eslint-disable-line no-undef
  console.log('Message received from main script', message.data)
  postMessage(123)
}

const test_data = [
  {
    key: '123',
    created: 1508969130086,
    last_updated: 1508969130086,
    subject: 'testing',
    snippet: 'this is a test'
  },
  {
    key: '456',
    created: 1508969435783,
    last_updated: 1508969486606,
    subject: 'more testing',
    snippet: 'this is another test',
  },
  {
    key: '789',
    created: 1508969486606,
    last_updated: 1508969486606,
    subject: 'and again',
    snippet: 'this is another test',
  }
]

db.transaction('rw', db.convs, async () => {
  if ((await db.convs.count()) === 0) {
    console.log('adding initial data')
    for (let d of test_data) {
      await db.convs.add(d)
    }
    postMessage({event: 'conv_list'})
  }
}).catch(e => {
  console.error(e.stack || e)
})

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
function rand (len) {
  let text = ''
  len = len || 10

  for (let i = 0; i < len; i++){
    text += ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length))
  }

  return text
}

onmessage = async function (message) { // eslint-disable-line no-undef
  if (message.data.event !== 'create_conv') {
    return
  }
  const conv_data = message.data.args
  // TODO send to server

  conv_data.key = 'dft-' + rand()
  conv_data.snippet = conv_data.body.substr(0, 20)
  conv_data.create = (new Date()).getTime()
  conv_data.last_updated = conv_data.create
  console.log(conv_data)

  db.transaction('rw', db.convs, async () => {
    await db.convs.add(conv_data)
    postMessage({event: 'convs'})
  }).catch(e => {
    console.error(e.stack || e)
  })
}
