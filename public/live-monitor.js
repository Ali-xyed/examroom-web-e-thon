import { createClient } from './vendor/supabase.js'
import config from './config.js'
import { sessionToken, examRequest, userId } from './api.js'

let globalAlerts
export function stopIntegrityAlerts(){globalAlerts?.stop();globalAlerts=undefined}
export async function ensureIntegrityAlerts(profile,{notify}) {
  if(profile.role!=='examiner'){stopIntegrityAlerts();return}
  const uid=userId()
  if(globalAlerts?.uid===uid)return
  stopIntegrityAlerts()
  let client,stopped=false
  const record={uid,stop(){stopped=true;clearInterval(renew);if(client)void client.removeAllChannels()}}
  globalAlerts=record
  const renew=setInterval(async()=>{try{if(client)await client.realtime.setAuth(await sessionToken())}catch{}},45000)
  try{
    const token=await sessionToken()
    if(stopped)return
    client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
    await client.realtime.setAuth(token)
    const seen=new Set()
    client.channel('examiner-alerts-'+uid+'-'+crypto.randomUUID()).on('postgres_changes',{event:'INSERT',schema:'public',table:'examroom_live_events',filter:'owner_id=eq.'+uid},message=>{
      if(stopped||seen.has(message.new.id))return
      seen.add(message.new.id)
      if(seen.size>2000)seen.delete(seen.values().next().value)
      const labels={page_hidden:'switched exam tab',focus_lost:'exam window lost focus',paste:'pasted into an answer',fullscreen_exit:'exited fullscreen',connection_lost:'reported a connection loss'}
      notify(message.new.candidate_name+' · '+(labels[message.new.event]||message.new.event)+' — indicator for review.')
    }).subscribe()
  }catch{record.stop();if(globalAlerts===record)globalAlerts=undefined}
}

export async function liveMonitor(examId,{notify,safe}) {
  const anchor=document.querySelector('#refresh-monitor')
  if(!anchor) return
  anchor.insertAdjacentHTML('afterend','<section class="panel form-panel" id="live-integrity"><h2>Live integrity feed</h2><p id="live-status" role="status">Connecting secure WebSocket…</p><p class="muted">Indicators for review, not proof of misconduct. Timing uses candidate-reported active time and server save timestamps.</p><div id="live-events" aria-live="polite"></div><div id="integrity-detail"></div></section>')
  const panel=document.querySelector('#live-integrity'),status=panel.querySelector('#live-status'),events=panel.querySelector('#live-events')
  let disposed=false,client,channel,busy=false
  const seen=new Set(),currentHash=location.hash
  const labels={page_hidden:'Switched exam tab',focus_lost:'Exam window lost focus',paste:'Pasted into an answer',fullscreen_exit:'Exited fullscreen',connection_lost:'Reported a lost connection'}
  async function detail(){
    if(busy||disposed)return
    busy=true
    try {
      const data=await examRequest('monitor',{examId})
      if(disposed||!panel.isConnected)return
      panel.querySelector('#integrity-detail').innerHTML=(data.integrity||[]).map(at=>`<details><summary>${safe(at.name)} · ${(at.disconnects||[]).length} disconnect records · ${(at.timings||[]).filter(t=>t.indicator).length} short answer timings</summary><p class="muted">Last heartbeat: ${at.lastSeen?safe(new Date(at.lastSeen).toLocaleString()):'Not received'}</p>${(at.disconnects||[]).map(d=>`<p>Connection gap: ${safe(new Date(d.started_at).toLocaleString())} → ${d.restored_at?safe(new Date(d.restored_at).toLocaleString()):'Awaiting reconnect'} (${safe(d.source)})</p>`).join('')}<p>${(at.timings||[]).map((t,i)=>`Answer ${i+1}: ${(t.activeMs/1000).toFixed(1)}s active; ${t.revisions} saves${t.indicator?' · Review short timing':''}`).join('<br>')||'No answer timings recorded.'}</p></details>`).join('')||'<p>No attempts have started.</p>'
    }catch(error){if(!disposed)status.textContent='Progress refresh failed: '+error.message}
    finally{busy=false}
  }
  const stop=()=>{
    if(disposed)return
    disposed=true;clearInterval(poll);clearInterval(refreshToken);window.removeEventListener('hashchange',route)
    if(client)void client.removeAllChannels()
  }
  const route=()=>{if(location.hash!==currentHash||!panel.isConnected)stop()}
  window.addEventListener('hashchange',route)
  const poll=setInterval(()=>{if(!panel.isConnected)stop();else void detail()},15000)
  const refreshToken=setInterval(async()=>{try{if(client)await client.realtime.setAuth(await sessionToken())}catch{}},45000)
  // show() emits this before replacing a view, including same-route refreshes.
  window.addEventListener('workspace-view-change',stop,{once:true})
  void detail()
  try {
    const token=await sessionToken()
    if(disposed)return
    client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
    await client.realtime.setAuth(token)
    channel=client.channel('exam-integrity-'+examId+'-'+crypto.randomUUID()).on('postgres_changes',{event:'INSERT',schema:'public',table:'examroom_live_events',filter:'exam_id=eq.'+examId},message=>{
      if(disposed||!panel.isConnected||seen.has(message.new.id))return
      seen.add(message.new.id)
      const row=message.new,text=row.candidate_name+' · '+(labels[row.event]||row.event)
      const item=document.createElement('p');item.textContent=text+' · '+new Date(row.created_at).toLocaleTimeString();events.prepend(item)
      while(events.children.length>20)events.lastElementChild.remove()
      void detail()
    }).subscribe(state=>{
      if(disposed)return
      status.textContent=state==='SUBSCRIBED'?'Live · secure WebSocket connected':state==='CHANNEL_ERROR'||state==='TIMED_OUT'?'Live connection interrupted · retrying; progress refresh stays active':'Connecting secure WebSocket…'
    })
  }catch(error){status.textContent='Live connection unavailable: '+error.message}
  return stop
}
