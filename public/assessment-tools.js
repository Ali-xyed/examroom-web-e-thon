import { examRequest, sessionToken } from './api.js'

const when=value=>new Date(value).toLocaleString()
export async function assessmentView(view,id,{show,safe,notify,profile}) {
  const examiner=profile.role==='examiner'
  const back=`<a class="back" href="#${examiner?'manage/'+id:''}">← ${examiner?'Manage examination':'My examinations'}</a>`
  if(view==='disputes') {
    const data=await examRequest('disputes',{examId:id})
    show(`${back}<div class="heading"><div><h1>${examiner?'Dispute queue':'Question and grade disputes'}</h1><p>Every decision is recorded. An ambiguous question awards full marks to every candidate assigned that question.</p></div>${examiner?`<a class="button secondary" href="#audit/${id}">View audit log</a>`:''}</div>
      ${!examiner?`<form id="new-dispute" class="panel form-panel"><h2>Raise a dispute</h2><label>Question<select name="questionId" required>${data.questions.map(q=>`<option value="${safe(q.id)}">${safe(q.prompt)}</option>`).join('')}</select></label><label>Dispute type<select name="kind"><option value="question">Question clarity or content</option><option value="grade">Published grade</option></select></label><label>Reason<textarea name="reason" minlength="10" maxlength="2000" required rows="3"></textarea></label><button class="primary" ${data.questions.length?'':'disabled'}>Submit dispute</button><p class="form-error" role="alert"></p></form>`:''}
      <section class="panel form-panel"><h2>${examiner?'Candidate disputes':'Your disputes'}</h2><label>Show<select id="dispute-filter"><option value="pending">Pending</option><option value="all">All decisions</option></select></label><div id="dispute-list"></div></section>`)
    const list=document.querySelector('#dispute-list')
    function render(){
      const filtered=data.disputes.filter(d=>document.querySelector('#dispute-filter').value==='all'||d.status==='pending')
      list.innerHTML=filtered.map(d=>`<article class="dispute-record"><div class="record-copy"><h3>${safe(d.prompt)}</h3><p>${safe(d.candidate)} · ${safe(d.kind)} · <span class="pill">${safe(d.status)}</span></p><p class="exam-instructions">${safe(d.reason)}</p><small>${safe(when(d.created_at))}</small>${d.decision_reason?`<p><strong>Decision:</strong> ${safe(d.resolution)} — ${safe(d.decision_reason)}</p>`:''}</div>${examiner&&d.status==='pending'?`<form data-dispute="${d.id}"><label>Decision<select name="resolution"><option value="reject">Reject</option><option value="accept">Accept concern (no mark change)</option><option value="ambiguous">Ambiguous question · full marks for all assigned attempts</option>${d.kind==='grade'?'<option value="grade">Accept and correct this candidate’s grade</option>':''}</select></label><label class="override-grade" hidden>Corrected grade (0–${d.marks})<input name="grade" type="number" min="0" max="${d.marks}" step="0.01"></label><label>Decision reason<textarea name="reason" minlength="10" maxlength="2000" rows="2" required></textarea></label><button class="secondary">Confirm decision</button><p class="form-error" role="alert"></p></form>`:''}</article>`).join('')||'<p class="empty-list">No matching disputes.</p>'
      list.querySelectorAll('[data-dispute]').forEach(form=>{
        const select=form.elements.resolution
        select.onchange=()=>{form.querySelector('.override-grade').hidden=select.value!=='grade';form.elements.grade.required=select.value==='grade'}
        form.onsubmit=async event=>{
          event.preventDefault();const button=form.querySelector('button');button.disabled=true
          try{const fields=Object.fromEntries(new FormData(form));await examRequest('dispute_resolve',{examId:id,disputeId:form.dataset.dispute,...fields});notify('Decision recorded and applicable scores recalculated.');await assessmentView(view,id,{show,safe,notify,profile})}
          catch(error){form.querySelector('.form-error').textContent=error.message;button.disabled=false}
        }
      })
    }
    document.querySelector('#dispute-filter').onchange=render;render()
    const form=document.querySelector('#new-dispute')
    if(form)form.onsubmit=async event=>{
      event.preventDefault();form.querySelector('button').disabled=true
      try{await examRequest('dispute_create',{examId:id,...Object.fromEntries(new FormData(form))});notify('Dispute submitted.');await assessmentView(view,id,{show,safe,notify,profile})}
      catch(error){form.querySelector('.form-error').textContent=error.message;form.querySelector('button').disabled=false}
    }
    return true
  }
  if(view==='audit') {
    const rows=await examRequest('audit',{examId:id})
    show(`${back}<h1>Immutable audit log</h1><p>Append-only history of dispute decisions, grade corrections, paper settings, and automatic regrades. Latest 500 records.</p><section class="panel form-panel">${rows.map(row=>`<details class="audit-entry"><summary>${safe(row.action)} · ${safe(row.actor||'System')} · ${safe(when(row.created_at))} · #${row.id}</summary><h3>Before</h3><pre>${safe(JSON.stringify(row.before_data,null,2))}</pre><h3>After</h3><pre>${safe(JSON.stringify(row.after_data,null,2))}</pre></details>`).join('')||'<p>No changes recorded yet.</p>'}</section>`)
    return true
  }
  if(view==='fairness') {
    const data=await examRequest('paper_pool',{examId:id})
    show(`${back}<h1>Difficulty-balanced papers</h1><section class="panel form-panel"><p>Choose how many questions to draw from each difficulty and marks bucket. Every candidate gets the same mix and total marks. The selected questions are fixed when the attempt starts.</p><p>Leave every count at zero to use the full question pool.</p><form id="paper-blueprint"><div class="table-scroll"><table><thead><tr><th>Difficulty</th><th>Marks each</th><th>Available</th><th>Questions per paper</th></tr></thead><tbody>${data.pool.map((b,i)=>`<tr><td>${safe(b.difficulty)}</td><td>${b.marks}</td><td>${b.available}</td><td><input aria-label="${safe(b.difficulty)} questions worth ${b.marks} marks" type="number" min="0" max="${b.available}" value="${data.buckets.find(x=>x.difficulty===b.difficulty&&Number(x.marks)===Number(b.marks))?.count||0}" data-bucket="${i}" ${data.published?'disabled':''}></td></tr>`).join('')}</tbody></table></div><p id="paper-totals" role="status"></p><button class="primary" ${data.published?'disabled':''}>Save paper blueprint</button><p class="form-error" role="alert"></p></form>${data.published?'<p>Published paper settings are locked.</p>':''}</section>`)
    const form=document.querySelector('#paper-blueprint')
    const buckets=()=>[...form.querySelectorAll('[data-bucket]')].map(input=>({...data.pool[Number(input.dataset.bucket)],count:Number(input.value)})).filter(x=>x.count>0).map(({difficulty,marks,count})=>({difficulty,marks:Number(marks),count}))
    const totals=()=>{const rows=buckets();document.querySelector('#paper-totals').textContent=rows.length?`${rows.reduce((s,b)=>s+b.count,0)} questions · ${rows.reduce((s,b)=>s+b.count*b.marks,0)} total marks per candidate`:'Full pool: '+data.pool.reduce((s,b)=>s+b.available,0)+' questions · '+data.pool.reduce((s,b)=>s+b.available*b.marks,0)+' marks'}
    form.oninput=totals;totals()
    form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await examRequest('paper_settings',{examId:id,buckets:buckets()});notify('Balanced paper blueprint saved.')}catch(error){form.querySelector('.form-error').textContent=error.message}finally{button.disabled=data.published}}
    return true
  }
  if(view==='datesheet') {
    const data=await examRequest('datesheet',{examId:id}),exam=data.exam
    show(`${back}<h1>Datesheet email</h1><section class="panel form-panel"><h2>${safe(exam.title)}</h2><dl class="metadata"><div><dt>Opens</dt><dd>${safe(when(exam.opens_at))}</dd></div><div><dt>Closes</dt><dd>${safe(when(exam.closes_at))}</dd></div><div><dt>Duration</dt><dd>${exam.duration} minutes</dd></div></dl><p>Emails include the schedule, instructions, and examination login link. Each candidate receives a separate email.</p><p class="exam-instructions">${safe(exam.instructions)}</p><h3>Recipient preview</h3><div class="candidate-directory-list">${data.candidates.map(c=>`<p><strong>${safe(c.name)}</strong> · ${safe(c.email)} · ${!c.deliverable?'Disabled account or demo address — skipped':safe(c.state)}</p>`).join('')||'<p>No enrolled candidates.</p>'}</div><button class="primary" id="send-datesheet" ${data.candidates.some(c=>c.deliverable&&c.state!=='sent')?'':'disabled'}>Send datesheet to pending recipients</button><p id="mail-status" role="status"></p></section>`)
    const button=document.querySelector('#send-datesheet'),status=document.querySelector('#mail-status')
    button.onclick=async()=>{
      button.disabled=true;let sent=0,failed=0
      try{
        status.textContent='Sending individual datesheets…'
        for(let batch=0;batch<100;batch++) {
          const response=await fetch('/api/datesheet',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await sessionToken()},body:JSON.stringify({examId:id})})
          const result=await response.json()
          if(!response.ok)throw new Error(result.error||'Email delivery failed.')
          sent+=result.sent;failed+=result.failed
          status.textContent=`${sent} sent · ${failed} failed`
          if(!result.processed||result.failed||result.processed<10)break
        }
        notify('Datesheet delivery finished.');status.textContent+=failed?' · Failed recipients can be retried.':' · Complete.'
      }catch(error){status.textContent=error.message}
      finally{button.disabled=false}
    }
    return true
  }
  return false
}

export function disputeShortcut(id,getQuestion,{safe,notify}) {
  const sidebar=document.querySelector('.attempt-sidebar')
  sidebar.insertAdjacentHTML('beforeend',`<details class="panel form-panel"><summary>Report a question issue</summary><p class="muted">This raises a dispute about the question currently displayed. The exam timer continues.</p><form id="attempt-dispute"><label>Reason<textarea name="reason" rows="3" minlength="10" maxlength="2000" required></textarea></label><button class="secondary">Send question dispute</button><p class="form-error" role="alert"></p></form></details><button type="button" class="secondary full" id="enter-fullscreen">Enter fullscreen</button><p class="muted integrity-notice">Tab changes, focus loss, paste, and fullscreen exits are recorded as review indicators.</p>`)
  const form=document.querySelector('#attempt-dispute')
  form.onsubmit=async event=>{event.preventDefault();form.querySelector('button').disabled=true;try{await examRequest('dispute_create',{examId:id,questionId:getQuestion().id,kind:'question',reason:new FormData(form).get('reason')});form.reset();notify('Question dispute submitted.')}catch(error){form.querySelector('.form-error').textContent=error.message}finally{form.querySelector('button').disabled=false}}
  document.querySelector('#enter-fullscreen').onclick=()=>document.documentElement.requestFullscreen().catch(()=>notify('Fullscreen is unavailable in this browser.',true))
}
