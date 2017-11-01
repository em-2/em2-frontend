import Worker from './main.worker.js'

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

export {worker}
