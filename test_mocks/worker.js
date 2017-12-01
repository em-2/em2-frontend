class _Worker {
  constructor (stringUrl) {
    this.url = stringUrl
    this.onmessage = () => {}
  }

  postMessage (msg) {
    console.log('post message:', msg)
  }
}

export default function Worker () {
  return new _Worker()
}
