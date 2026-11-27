// LocalStorage helpers scoped to the signed-in user (mirrors phase-three.js)
import { userId } from './api.js'

function storageKey(name) {
  return 'uncooked-' + userId() + '-' + name
}

export function readLocal(name, fallback) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(name))) ?? fallback
  } catch {
    return fallback
  }
}

export function writeLocal(name, value) {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeLocal(name) {
  localStorage.removeItem(storageKey(name))
}
