import Worker from './main.worker.js'

if (typeof(window) !== 'object') {
  throw Error('worker.js should only be called from the window, not a worker')
}

const worker = Worker()

const METHOD_LOOKUP = {}

worker.add_listener = (name, method) => {
  METHOD_LOOKUP[name] = method
}

worker.onmessage = function (message) {
  if (message.data.method === undefined) {
    return
  }
  const method = METHOD_LOOKUP[message.data.method]
  if (method === undefined) {
    console.error(`window: method "${message.data.method}" not found`, message)
  } else {
    method(message)
  }
}

export default worker
