import Dexie from 'dexie'

const db = new Dexie('conversations')
db.version(1).stores({
  convs: 'key,updated_ts,created_ts,published',
  messages: 'key,conv_key',
  actions: 'key,conv_key,message,participant',
  // TODO pending actions
})

export default db
