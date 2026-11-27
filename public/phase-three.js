import { examRequest, userId } from './api.js'
import config from './config.js'
import { bindImportPreview } from './import-preview.js'

function storageKey(name) { return 'uncooked-' + userId() + '-' + name }
export function readLocal(name, fallback) {
  try { return JSON.parse(localStorage.getItem(storageKey(name))) ?? fallback } catch { return fallback }
}
export function writeLocal(name, value) {
  try { localStorage.setItem(storageKey(name), JSON.stringify(value)); return true } catch { return false }
}
export function removeLocal(name) { localStorage.removeItem(storageKey(name)) }

export function downloadReport(report) {
  const lines = ['UnCooked examination report', report.title, new Date().toLocaleString()]
  if (report.examiner) {
    lines.push('Examiner summary')
    for (const score of report.scores) lines.push(score.name + ' | ' + score.score + '/' + score.total + ' | Pending written grades: ' + score.pending)
  } else {
    lines.push(report.name, 'Score: ' + report.score + ' / ' + report.total,
      'Verification code: ' + report.token,
      location.origin + '/?verify=' + report.token)
  }
  const clean = text => String(text).normalize('NFKD').replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&')
  const wrapped = lines.flatMap(line => String(line).match(/.{1,88}/g) || [''])
  const pages = []
  for (let i=0; i<wrapped.length; i+=42) pages.push(wrapped.slice(i,i+42))
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const pageIds = []
  for (const page of pages) {
    const id = objects.length+1
    pageIds.push(id)
    const stream = 'BT /F1 11 Tf 45 790 Td 17 TL ' + page.map((line,i)=>(i?'T* ':'')+'('+clean(line)+') Tj').join('\n') + ' ET'
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+(id+1)+' 0 R >>')
    objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream')
  }
  objects[1]='<< /Type /Pages /Count '+pages.length+' /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] >>'
  let pdf='%PDF-1.4\n'
  const offsets=[0]
  objects.forEach((object,i)=>{ offsets.push(pdf.length); pdf+=(i+1)+' 0 obj\n'+object+'\nendobj\n' })
  const xref=pdf.length
  pdf+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')
  pdf+='trailer << /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF'
  const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}))
  const a=document.createElement('a'); a.href=url; a.download='UnCooked-report.pdf'; a.click()
  setTimeout(()=>URL.revokeObjectURL(url),10000)
}

export async function verification(code, show, safe) {
  const response=await fetch(config.url+'/rest/v1/rpc/verify_report',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({code})})
  if(!response.ok) throw new Error('Report could not be verified.')
  const result=await response.json()
  show('<section class="panel form-panel"><h1>Report verification</h1><p>'+ (result.valid?'This report is authentic and its issued result is still valid.':'This code is invalid or the result has changed or been unpublished.')+'</p>'+(result.valid?'<p>Issued '+safe(new Date(result.issuedAt).toLocaleString())+'</p>':'')+'<a href="/">UnCooked home</a></section>')
}

export async function phaseThree(view,id,{show,safe,notify,profile,take}) {
  if (view==='sandbox') {
    take(id,await examRequest('sandbox',{examId:id})); return true
  }
  if(view==='analytics') {
    const rows=await examRequest('analytics',{examId:id})
    show('<a class="back" href="#manage/'+id+'">Manage exam</a><h1>Question analytics</h1>'+
      rows.map(q=>'<section class="panel form-panel"><h2>'+safe(q.prompt)+'</h2><p>'+q.attempts+' submitted attempts · '+q.skipped+' skipped · '+q.incorrect+' incorrect objective responses</p>'+(q.average_written_mark!==null?'<p>Average written mark '+Number(q.average_written_mark).toFixed(2)+' / '+q.marks+'</p>':'')+'</section>').join(''))
    return true
  }
  if(view==='import') {
    const administrator=profile.role==='administrator'
    const sample=administrator ? [{name:'Example Candidate',email:'candidate2@example.com',password:'Choose-a-unique-password'}] :
      [{prompt:'Which number is prime?',kind:'single',choices:['4','7','8','9'],correct:1,correctSet:[],marks:1,topic:'Mathematics',difficulty:'easy'}]
    show('<a class="back" href="#">Examinations</a><h1>Bulk import</h1><section class="panel form-panel"><p>'+
      (administrator?'Import candidate accounts. Each record needs a name, email, and password of at least 12 characters.':'Import question-bank records. Use single, multiple, or written for kind. Multiple-select requires correctSet indexes from 0 to 3.')+
      '</p><p>Upload a JSON array with up to 200 records. Review the preview, then confirm the import.</p><button class="secondary" id="sample">Download sample JSON</button><form id="import-form"><label>JSON file<input type="file" accept=".json,application/json" required id="import-file"></label><section id="import-preview" aria-live="polite"></section><button class="primary" id="confirm-import" disabled>Confirm import</button><p id="import-status" role="status"></p></form></section>')
    document.querySelector('#sample').onclick=()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify(sample,null,2)],{type:'application/json'}))
      const a=document.createElement('a');a.href=url;a.download='import-sample.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)
    }
    bindImportPreview(administrator, safe, examRequest)
    return true
  }
  return false
}

export function workspaceTools(id,sandbox,notify) {
  const sidebar=document.querySelector('.attempt-sidebar')
  sidebar.insertAdjacentHTML('beforeend', '<details class="panel form-panel"><summary>Workspace preferences</summary><label>Text size<select id="text-size"><option value="16">Standard</option><option value="20">Large</option><option value="24">Extra large</option></select></label><label>Layout<select id="workspace-layout"><option value="side">Side navigator</option><option value="stack">Stacked navigator</option></select></label></details><details class="panel form-panel"><summary>Digital scratchpad</summary><label>Rough work<textarea id="scratchpad" rows="7" maxlength="20000" placeholder="Write your working here"></textarea></label><p class="muted">Saved on this browser for this exam.</p></details>')
  const prefs=readLocal('preferences',{size:'16',layout:'side'})
  const size=document.querySelector('#text-size'),layout=document.querySelector('#workspace-layout')
  size.value=prefs.size;layout.value=prefs.layout
  function apply(){
    document.querySelector('#question').style.fontSize=size.value+'px'
    document.querySelector('.attempt-grid').classList.toggle('stacked',layout.value==='stack')
    if(!writeLocal('preferences',{size:size.value,layout:layout.value})) notify('Workspace preferences could not be saved in this browser.',true)
  }
  size.onchange=apply;layout.onchange=apply;apply()
  const pad=document.querySelector('#scratchpad'),key=(sandbox?'sandbox-':'')+'scratch-'+id
  pad.value=readLocal(key,'')
  pad.oninput=()=>{if(!writeLocal(key,pad.value)) notify('Scratchpad could not be saved in this browser.',true)}
}
