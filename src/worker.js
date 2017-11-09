import Worker from './main.worker.js'

if (typeof(window) !== 'object') {
  throw Error('worker.js should only be called from the window, not a worker')
}

const worker = Worker()

const METHOD_LOOKUP = {}

// TODO (maybe) allow multiple registered listeners with the same name?
worker.add_listener = (name, method) => {
  METHOD_LOOKUP[name] = method
}

worker.remove_listener = (name) => {
  delete METHOD_LOOKUP[name]
}

worker.onmessage = function (message) {
  if (message.data.method === undefined) {
    return
  }
  const method = METHOD_LOOKUP[message.data.method]
  if (method === undefined) {
    // ok: console.error(`window: method "${message.data.method}" not found`, message)
  } else {
    method(message)
  }
}

export default worker
