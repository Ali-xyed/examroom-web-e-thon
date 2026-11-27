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

function friendlyError(message) {
  if (!message) return 'Something went wrong. Please try again.'
  if (message === 'No Examroom role is assigned.') return 'No role is assigned to this account.'
  const rowMatch = message.match(/^Row (\d+):\s*(.+?)\.\s*No records were imported\.$/i)
  if (rowMatch) {
    const [, rowNum, detail] = rowMatch
    if (/users_email|duplicate key/i.test(detail)) {
      return `Row ${rowNum}: An account with this email already exists. Please use a different email or remove this row. No records were imported.`
    }
    return `Row ${rowNum}: ${friendlyError(detail)} No records were imported.`
  }
  if (/duplicate key value violates unique constraint/i.test(message)) {
    return 'A record with this value already exists. Please check for duplicates and try again.'
  }
  if (/violates check constraint/i.test(message)) {
    return 'One or more values are outside the allowed range. Please review your input.'
  }
  if (/violates foreign key constraint/i.test(message)) {
    return 'This item is linked to other records and cannot be changed right now.'
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Incorrect email or password. Please check your credentials and try again.'
  }
  return message
}

async function request(path, body, token) {
  const headers = { apikey: config.key, 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  let response
  try {
    response = await fetch(config.url + path, {
      method: 'POST', headers, body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
  } catch (err) {
    if (err?.name === 'TimeoutError' || /timed out/i.test(err?.message || '')) {
      throw new Error('The request timed out. Please check your connection and try again.')
    }
    throw new Error('Unable to reach the server. Please check your internet connection and try again.')
  }
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.msg || data.message || 'The request failed.'
    throw Object.assign(new Error(friendlyError(message)), { status: response.status })
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

// Share only the current short-lived user token with authenticated app services.
export const sessionToken = () => accessToken()
