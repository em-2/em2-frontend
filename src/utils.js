import format from 'date-fns/format'

const env = process.env
export const urls = {
  main: {
    list: env.REACT_APP_MAIN_URL + '/list/',
    get: env.REACT_APP_MAIN_URL + '/c/{conv}/',
    actions: env.REACT_APP_MAIN_URL + '/c/{conv}/actions/',
    create: env.REACT_APP_MAIN_URL + '/create/',
    publish: env.REACT_APP_MAIN_URL + '/publish/{conv}/',
    act: env.REACT_APP_MAIN_URL + '/act/{conv}/{component}/{verb}/'
  },
  auth: {
    login: env.REACT_APP_AUTH_URL + '/login/',
    account: env.REACT_APP_AUTH_URL + '/account/',
  },
  ws: env.REACT_APP_WS_URL,
}

export function url_sub (url, subs) {
  for (let [name, value] of Object.entries(subs)) {
    url = url.replace('{' + name + '}', value)
  }
  return url
}

const ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789'
export function rand (prefix) {
  let text = prefix + '-'
  const len = 20 - prefix.text

  for (let i = 0; i < len; i++){
    text += ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length))
  }
  return text
}


export async function post_json (url, payload, allowed_responses) {
  const r = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  })
  allowed_responses = allowed_responses || [200, 201]
  // console.log('request', r)
  if (allowed_responses.includes(r.status)) {
    return {
      status: r.status,
      json: await r.json(),
    }
  } else {
    const body = await r.text()
    console.error('request error:', r, body)
    throw Error(`error posting to ${url}, status: ${r.status}`)
  }
}

function RequestError (message, url, error, status){
  this.message = message
  this.url = url
  this.error = error
  this.status = status
}

RequestError.prototype = new Error()


export async function get_json (url, allowed_responses) {
  let r
  try {
    r = await fetch(url, {
      credentials: 'include',
      headers: {'Accept': 'application/json'},
    })
  } catch (e) {
    console.error('fetch error:', e)
    throw new RequestError(`error getting to ${url}: ${e}`, url, e)
  }
  // console.log('request', r)
  allowed_responses = allowed_responses || [200]
  if (allowed_responses.includes(r.status)) {
    return {
      status: r.status,
      json: await r.json(),
    }
  } else {
    console.error('request error:', r)
    throw new RequestError(`error getting ${url}, status: ${r.status}`, url, r, r.status)
  }
}

export const now = () => (new Date()).getTime()
export const ts2int = ts => (new Date(ts)).getTime()

const DTF = 'HH:mm DD/MM/YYYY'

export const format_ts = ts => format(new Date(ts), DTF)
