import Worker from './main.worker.js'

if (typeof(window) !== 'object') {
  throw Error('worker.js should only be called from the window, not a worker')
}

const worker = Worker()

const LISTENERS = {}

// TODO (maybe) allow multiple registered listeners with the same name?
worker.add_listener = (name, method) => {
  const id = Math.floor(Math.random() * 1e6)
  LISTENERS[id] = {name, method}
  return id
}

worker.remove_listener = (id) => {
  delete LISTENERS[id]
}

worker.onmessage = function (message) {
  if (message.data.method === undefined) {
    return
  }
  for (let l of Object.values(LISTENERS)) {
    if (l.name === message.data.method) {
      l.method(message)
    }
  }
}

export default worker
