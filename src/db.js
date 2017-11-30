import Dexie from 'dexie'
import {urls, get_json} from './utils'

export const meta_db = new Dexie('em2:users')
meta_db.version(1).stores({
  users: 'address',
})

export async function get_current_user () {
  // TODO allow address to be supplied
  return await meta_db.transaction('r', meta_db.users, async () => {
    return (await meta_db.users.toArray())[0]
  })
}

export async function create_user_db () {
  // TODO allow address to be supplied
  const user = await get_current_user()
  if (!user) {
    return null
  }
  const db = new Dexie('em2:' + user.address)
  db.user = user
  db.version(1).stores({
    convs: 'key,old_key,updated_ts,created_ts,published',
    messages: 'key,conv_key',
    participants: 'address,conv_key',
    actions: 'key,conv_key,message,participant',
  })
  return db
}

export async function update_meta_db () {
  // TODO choice which db
  const r = await get_json(urls.auth.account, [200, 401])
  if (r.status === 200) {
    await meta_db.transaction('rw', meta_db.users, async () => {
      await meta_db.users.put(r.json)
    })
  } else if (r.status === 401) {
    postMessage({method: 'update_global', state: {authenticated: false}})
  }
}
