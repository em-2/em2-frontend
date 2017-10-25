import Dexie from 'dexie'

const db = new Dexie('conversations')
db.version(1).stores({
  convs: 'key,last_updated,created'
})

export default db
