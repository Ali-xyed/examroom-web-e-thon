import config from './config.js'

let session
let refreshing
let sessionVersion = 0
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
  const version = ++sessionVersion
  const response = await request('/auth/v1/token?grant_type=password', { email, password })
  if (version !== sessionVersion) throw new Error('The sign-in session changed. Please try again.')
  acceptSession(response)
}

export async function signOut() {
  const token = session?.access_token
  sessionVersion++
  storeSession(null)
  if (token) await request('/auth/v1/logout?scope=local', {}, token).catch(() => {})
}

async function accessToken(forceRefresh = false) {
  if (!session) throw new Error('Sign in to continue.')
  if (!forceRefresh && session.expiresAt > Date.now() + 60000) return session.access_token
  const version = sessionVersion
  refreshing ??= request('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
    .then(response => {
      if (version !== sessionVersion) throw new Error('The sign-in session changed. Please try again.')
      return acceptSession(response)
    })
    .catch(error => {
      if (version === sessionVersion && error.status >= 400 && error.status < 500) endSession('Your session expired. Please sign in again.')
      throw error
    })
    .finally(() => { refreshing = null })
  return refreshing
}

function endSession(message) {
  sessionVersion++
  storeSession(null)
  globalThis.dispatchEvent(new CustomEvent('session-ended', {detail: message}))
}

export async function examRequest(operation, payload = {}) {
  const path = '/rest/v1/rpc/examroom_request'
  const version = sessionVersion
  try {
    const token = await accessToken()
    try {
      return await request(path, { operation, payload }, token)
    } catch (error) {
      if (error.status !== 401 || !session || version !== sessionVersion) throw error
      return await request(path, { operation, payload }, await accessToken(true))
    }
  } catch (error) {
    if (version === sessionVersion && ['Account unavailable.', 'No role is assigned to this account.'].includes(error.message)) {
      endSession('This account is disabled or unavailable. Contact your administrator, or sign in with another account.')
    }
    throw error
  }
}
