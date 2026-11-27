import config from './config.js'

let session
let refreshing
const sessionKey = 'examroom-session'
try {
  session = JSON.parse(sessionStorage.getItem(sessionKey))
} catch {
  sessionStorage.removeItem(sessionKey)
}

function storeSession(value) {
  session = value
  if (value) sessionStorage.setItem(sessionKey, JSON.stringify(value))
  else sessionStorage.removeItem(sessionKey)
}

async function request(path, body, token) {
  const headers = { apikey: config.key, 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const response = await fetch(config.url + path, {
    method: 'POST', headers, body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (response.status === 204) return null
  const data = await response.json()
  if (!response.ok) {
    const message = data.msg || data.message || 'The request failed.'
    const displayMessage = message === 'No Examroom role is assigned.' ? 'No role is assigned to this account.' : message
    throw Object.assign(new Error(displayMessage), { status: response.status })
  }
  return data
}

function acceptSession(response) {
  storeSession({ ...response, expiresAt: Date.now() + response.expires_in * 1000 })
  return response.access_token
}

export function hasSession() {
  return Boolean(session)
}

export function userId() {
  return session?.user?.id || 'signed-out'
}

export async function signIn(email, password) {
  acceptSession(await request('/auth/v1/token?grant_type=password', { email, password }))
}

export async function signOut() {
  const token = session?.access_token
  storeSession(null)
  if (token) await request('/auth/v1/logout?scope=local', {}, token).catch(() => {})
}

async function accessToken(forceRefresh = false) {
  if (!session) throw new Error('Sign in to continue.')
  if (!forceRefresh && session.expiresAt > Date.now() + 60000) return session.access_token
  refreshing ??= request('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
    .then(acceptSession)
    .catch(error => {
      if (error.status >= 400 && error.status < 500) storeSession(null)
      throw error
    })
    .finally(() => { refreshing = null })
  return refreshing
}

export async function examRequest(operation, payload = {}) {
  const path = '/rest/v1/rpc/examroom_request'
  try {
    return await request(path, { operation, payload }, await accessToken())
  } catch (error) {
    if (error.status !== 401 || !session) throw error
    return request(path, { operation, payload }, await accessToken(true))
  }
}
