import db from './db'
console.info('worker starting')

onmessage = async function (message) { // eslint-disable-line no-undef
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
    postMessage({'event': 'convs'})
  }

  const all = await db.convs.toArray()
  console.log('convs:', JSON.stringify(all, null, 2))
}).catch(e => {
  console.error(e.stack || e)
})
