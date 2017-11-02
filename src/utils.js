
const env = process.env  // eslint-disable-line no-undef
export const urls = {
  main: {
    list: env.REACT_APP_MAIN_URL + '/list/',
    create: env.REACT_APP_MAIN_URL + '/create/',
    publish: env.REACT_APP_MAIN_URL + '/publish/{conv}/',
  },
  auth: {
    login: env.REACT_APP_AUTH_URL + '/login/'
  }
}

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
export function rand (len) {
  let text = ''
  len = len || 10

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
    console.error('request error:', r)
    throw Error(`error posting to ${url}, status: ${r.status}`)
  }
}

export async function get_json (url, allowed_responses) {
  let r
  try {
    r = await fetch(url, {
      credentials: 'include',
      headers: {'Accept': 'application/json'},
    })
  } catch (e) {
    console.error('fetch error:', e)
    throw Error(`error getting to ${url}: ${e}`)
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
    throw Error(`error getting ${url}, status: ${r.status}`)
  }
}
