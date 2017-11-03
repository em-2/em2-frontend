import db from './db'
import {urls, rand, get_json} from './utils'

console.info('worker starting')

const METHODS = [
  add_message,
  update_convs,
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

async function update_convs () {
  const r = await get_json(urls.main.list, [200, 401])
  if (r.status === 200) {
    postMessage({method: 'update_global', state: {authenticated: true}})
    db.transaction('rw', db.convs, async () => {
      // let existing = await db.convs.where('key').anyOf(r.json.map(c => c.key)).toArray()
      // existing = existing.map(c => c.key)
      for (let conv of r.json) {
        console.log(conv.ts)
        let dt = (new Date(conv.ts)).getTime()
        await db.convs.put({
          key: conv.key,
          subject: conv.subject,
          snippet: conv.subject + ' this is the summary',
          last_updated: dt,
          created: dt,
          published: conv.published,
        })
      }
    })
    postMessage({method: 'conv_list'})
  } else if (r.status === 401) {
    postMessage({method: 'update_global', state: {authenticated: false}})
  }
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
