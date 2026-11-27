import { userId } from './api.js'

let database
function open() {
  database ??= new Promise((resolve,reject) => {
    const request=indexedDB.open('uncooked-recovery',1)
    request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'key'})
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error)
  }).catch(error=>{database=undefined;throw error})
  return database
}
export async function storeRecord(name,value) {
  const db=await open(), key=userId()+'/'+name
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite')
    if(value===undefined) tx.objectStore('records').delete(key)
    else tx.objectStore('records').put({key,value})
    tx.oncomplete=()=>resolve()
    tx.onerror=()=>reject(tx.error)
    tx.onabort=()=>reject(tx.error || new Error('Local storage transaction failed.'))
  })
}
export async function loadRecord(name,fallback) {
  const db=await open()
  return new Promise((resolve,reject)=>{
    const req=db.transaction('records').objectStore('records').get(userId()+'/'+name)
    req.onsuccess=()=>resolve(req.result?.value??fallback)
    req.onerror=()=>reject(req.error)
  })
}

// Incidents are persisted before sending. UUIDs make reconnect retries idempotent.
export function integrityCapture(examId,request,onHeartbeat,onError) {
  let stopped=false, flushing=false, queue=[], serial=Promise.resolve()
  const connectionId=crypto.randomUUID(),key='incidents/'+examId
  const persist=()=>storeRecord(key,queue).catch(()=>onError('Incident recovery storage is unavailable.'))
  const ready=loadRecord(key,[]).then(items=>{queue=items}).catch(()=>{})
  async function flush() {
    await ready
    if(stopped||flushing||!navigator.onLine) return
    flushing=true
    try {
      while(queue.length&&!stopped) {
        await request('incident',queue[0])
        queue.shift(); await persist()
      }
    } catch { /* Keep persisted incidents for reconnect. */ }
    finally {flushing=false}
  }
  const last=new Map()
  function capture(event) {
    if(stopped) return
    const now=Date.now()
    if(now-(last.get(event)||0)<1000) return
    last.set(event,now)
    serial=serial.then(async()=>{
      await ready
      queue.push({examId,event,clientId:crypto.randomUUID(),clientAt:new Date(now).toISOString()})
      await persist();void flush()
    })
  }
  let beating=false
  async function beat(){
    if(stopped||beating||!navigator.onLine) return
    beating=true
    try {const result=await request('heartbeat',{examId,connectionId});if(!stopped)onHeartbeat(result);void flush()}
    catch { /* Next heartbeat retries independently of answer saves. */ }
    finally {beating=false}
  }
  const hidden=()=>{if(document.hidden)capture('page_hidden')}
  const blur=()=>capture('focus_lost')
  const paste=event=>{if(event.target.closest?.('#question'))capture('paste')}
  let wasFullscreen=Boolean(document.fullscreenElement)
  const fullscreen=()=>{if(wasFullscreen&&!document.fullscreenElement)capture('fullscreen_exit');wasFullscreen=Boolean(document.fullscreenElement)}
  const offline=()=>capture('connection_lost')
  document.addEventListener('visibilitychange',hidden)
  document.addEventListener('paste',paste)
  document.addEventListener('fullscreenchange',fullscreen)
  window.addEventListener('blur',blur)
  window.addEventListener('offline',offline)
  window.addEventListener('online',beat)
  const interval=setInterval(beat,15000)
  void beat()
  return ()=>{
    stopped=true;clearInterval(interval)
    document.removeEventListener('visibilitychange',hidden);document.removeEventListener('paste',paste)
    document.removeEventListener('fullscreenchange',fullscreen);window.removeEventListener('blur',blur)
    window.removeEventListener('offline',offline);window.removeEventListener('online',beat)
  }
}
