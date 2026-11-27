import { examRequest } from './api.js'
import { downloadReport } from './phase-three.js'

export async function phaseTwo(view, id, { show, safe, notify, profile }) {
  const links = profile.role === 'administrator' ? '<a class="button secondary" href="#users">Manage users</a>'
    : profile.role === 'examiner' ? '<a class="button secondary" href="#bank">Question bank</a>' : ''
  if (!view) return links
  const back = '<a class="back" href="#">Examinations</a>'
  async function action(operation, payload, after) {
    try { await examRequest(operation, payload); await after() }
    catch (error) { notify(error.message, true) }
  }
  if (view === 'users') {
    const users = await examRequest('admin_list')
    show(back + '<h1>User management</h1><div id="editor"></div><div class="panel form-panel">' +
      users.map(user => `<p><strong>${safe(user.name)}</strong> · ${safe(user.email)} · ${safe(user.role)} · ${user.active ? 'Active' : 'Disabled'}
      <button class="secondary" data-user="${user.id}">Edit account</button></p>`).join('') + '</div>')
    function editor(user = {}) {
      document.querySelector('#editor').innerHTML = `<form class="panel form-panel">
      <h2>${user.id ? 'Edit account' : 'Create account'}</h2>
      <label>Name<input name="name" required maxlength="100" value="${safe(user.name)}"></label>
      ${user.id ? '' : '<label>Email<input name="email" type="email" required></label>'}
      <label>Role<select name="role">${['candidate','examiner','administrator'].map(role => `<option ${user.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select></label>
      <div class="password-wrap">
        <label>${user.id ? 'New password (optional)' : 'Password'}<input id="password" name="password" type="password" minlength="12" ${user.id ? '' : 'required'} autocomplete="new-password"></label>
        <button type="button" id="password-toggle" aria-label="Show password" aria-controls="password" aria-pressed="false"><span aria-hidden="true"></span></button>
      </div>
      <label class="flag"><input name="active" type="checkbox" ${user.active !== false ? 'checked' : ''}> Active account</label>
      <button class="primary">Save account</button></form>`
      const password = document.querySelector('#editor [name="password"]')
      const toggle = document.querySelector('#editor #password-toggle')
      toggle.onclick = () => {
        const visible = password.type === 'password'
        password.type = visible ? 'text' : 'password'
        toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password')
        toggle.setAttribute('aria-pressed', String(visible))
        toggle.classList.toggle('revealed', visible)
      }
      document.querySelector('#editor form').onsubmit = async event => {
        event.preventDefault()
        const data = Object.fromEntries(new FormData(event.currentTarget))
        data.id = user.id
        data.active = Boolean(data.active)
        await action('admin_save', data, () => phaseTwo(view, id, {show,safe,notify,profile}))
      }
    }
    editor()
    document.querySelectorAll('[data-user]').forEach(button => button.onclick = () => editor(users.find(u => u.id === button.dataset.user)))
    return true
  }
  if (view === 'bank') {
    const bank = await examRequest('bank')
    show(back + '<h1>Question bank</h1><div id="bank-editor"></div>' +
      '<div class="panel form-panel"><label>Filter by topic or difficulty<input id="filter"></label><div id="bank-list"></div></div>')
    function list(filter = '') {
      document.querySelector('#bank-list').innerHTML = bank.filter(q => (q.topic+' '+q.difficulty+' '+q.prompt).toLowerCase().includes(filter.toLowerCase()))
        .map(q => `<p>${safe(q.prompt)} · ${safe(q.topic)} · ${q.difficulty} · ${q.kind} · ${q.marks} marks <button type="button" class="secondary" data-edit="${q.id}">Edit</button></p>`).join('')
      document.querySelectorAll('[data-edit]').forEach(button => editorListener(button, bank.find(q => q.id === button.dataset.edit)))
    }
    function editorListener(button, q) { button.onclick = () => editor(q) }
    function editor(q = {}) {
      document.querySelector('#bank-editor').innerHTML = `<form class="panel form-panel"><h2>${q.id ? 'Edit question' : 'New question'}</h2>
        <label>Question<textarea name="prompt" required maxlength="2000">${safe(q.prompt)}</textarea></label>
        <div class="fields"><label>Type<select name="kind">${[['single','Single-answer MCQ'],['multiple','Multiple-select MCQ'],['written','Written response']].map(([kind,label]) => `<option value="${kind}" ${q.kind===kind?'selected':''}>${label}</option>`).join('')}</select></label>
        <label>Topic<input name="topic" required maxlength="100" value="${safe(q.topic || 'General')}"></label>
        <label>Difficulty<select name="difficulty">${['easy','medium','hard'].map(d => `<option ${q.difficulty===d?'selected':''}>${d}</option>`).join('')}</select></label>
        <label>Marks<input name="marks" type="number" min="1" max="100" value="${q.marks || 1}" required></label></div>
        <p class="muted" id="marking-help"></p>
        <fieldset data-question-types="single multiple"><legend>Answer choices</legend><div class="fields">${['A','B','C','D'].map((letter,i) => `<label>Choice ${letter}<input name="choice" maxlength="500" value="${safe(q.kind === 'written' ? '' : q.choices?.[i] || '')}"></label>`).join('')}</div></fieldset>
        <label data-question-types="single">Correct answer<select name="correct">${['A','B','C','D'].map((letter,i) => `<option value="${i}" ${q.correct===i?'selected':''}>${letter}</option>`).join('')}</select></label>
        <fieldset data-question-types="multiple"><legend>Correct answers</legend>${['A','B','C','D'].map((letter,i) => `<label class="flag"><input type="checkbox" name="correctSet" value="${i}" ${q.correct_set?.includes(i)?'checked':''}>${letter}</label>`).join('')}</fieldset>
        <button class="primary">Save question</button> <button class="secondary" type="button" id="new-bank">New question</button></form>`
      document.querySelector('#new-bank').onclick = () => editor()
      const form = document.querySelector('#bank-editor form')
      const type = form.elements.kind
      const correctChoices = [...form.querySelectorAll('[name="correctSet"]')]
      function validateCorrectChoices() {
        const missing = type.value === 'multiple' && !correctChoices.some(input => input.checked)
        correctChoices[0].setCustomValidity(missing ? 'Select at least one correct answer.' : '')
      }
      function updateQuestionType() {
        for (const group of form.querySelectorAll('[data-question-types]')) {
          const visible = group.dataset.questionTypes.split(' ').includes(type.value)
          group.hidden = !visible
          for (const input of group.querySelectorAll('input, select')) {
            input.disabled = !visible
            input.required = visible && input.name === 'choice'
          }
        }
        document.querySelector('#marking-help').textContent = {
          single: 'Enter four choices and select one correct answer.',
          multiple: 'Enter four choices and select the correct answers. Candidates must select exactly those answers for full marks.',
          written: 'Candidates enter a written response. The examiner grades it up to the assigned marks.',
        }[type.value]
        validateCorrectChoices()
      }
      type.onchange = updateQuestionType
      correctChoices.forEach(input => input.onchange = validateCorrectChoices)
      updateQuestionType()
      document.querySelector('#bank-editor form').onsubmit = async event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const payload = Object.fromEntries(data)
        payload.id=q.id
        payload.choices = payload.kind === 'written' ? ['Unused 0','Unused 1','Unused 2','Unused 3'] : data.getAll('choice')
        payload.correct = payload.kind === 'single' ? Number(data.get('correct')) : 0
        payload.correctSet = payload.kind === 'multiple' ? data.getAll('correctSet').map(Number) : []
        await action('bank_save',payload,()=>phaseTwo(view,id,{show,safe,notify,profile}))
      }
    }
    editor(); list()
    document.querySelector('#filter').oninput = event => list(event.target.value)
    return true
  }
  if (view === 'monitor') {
    const data = await examRequest('monitor',{examId:id})
    show(back + `<h1>Monitor and grade</h1><p>Incidents are signals for review. They do not establish misconduct.</p>
      <button class="secondary" id="refresh-monitor">Refresh progress</button><p class="muted">Refresh to load the latest answers, incidents, and expired submissions.</p>
      <form class="panel form-panel" id="announce"><label>Announcement<textarea name="message" required maxlength="2000"></textarea></label><button class="primary">Send announcement</button></form>
      <section class="panel form-panel"><h2>Results</h2><p>${data.scores.length} submitted attempts · Average score ${data.scores.length ? (data.scores.reduce((s,r)=>s+Number(r.score),0)/data.scores.length).toFixed(2) : '—'}</p>
      ${data.scores.map(s=>`<p>${safe(s.name)} · ${s.score}/${s.total} · ${s.pending} written questions awaiting grading</p>`).join('')}
      <button class="primary" id="publish-results">${data.published?'Unpublish results':'Publish results'}</button> <button class="secondary" id="report">Download PDF summary</button></section>
      ${data.attempts.map(at=>`<section class="panel form-panel"><h2>${safe(at.name)}</h2><p>${at.submittedAt?'Submitted':'In progress'} · ${at.answered} answered</p>
        <ul>${at.incidents.map(i=>`<li>${safe(i.event)} · ${new Date(i.created_at).toLocaleString()}</li>`).join('')}</ul>
        ${at.submittedAt ? at.written.map(q=>`<form data-grade="${at.id}" data-question="${q.id}"><h3>${safe(q.prompt)}</h3><p class="exam-instructions">${safe(q.response || '(No response)')}</p>
          <label>Marks out of ${q.marks}<input type="number" name="grade" min="0" max="${q.marks}" step="0.01" value="${q.grade??''}" required ${data.published?'disabled':''}></label>
          <button class="secondary" ${data.published?'disabled':''}>Save grade</button></form>`).join('') : ''}</section>`).join('')}`)
    const refresh=()=>phaseTwo(view,id,{show,safe,notify,profile})
    document.querySelector('#refresh-monitor').onclick=()=>refresh().catch(e=>notify(e.message,true))
    document.querySelector('#announce').onsubmit=event=>{
      event.preventDefault(); action('announce',{examId:id,message:new FormData(event.currentTarget).get('message')},refresh)
    }
    document.querySelector('#publish-results').onclick=()=>action('publish_results',{examId:id,published:!data.published},refresh)
    document.querySelector('#report').onclick=async()=>{
      try { downloadReport(await examRequest('report',{examId:id})) } catch(error) { notify(error.message,true) }
    }
    document.querySelectorAll('[data-grade]').forEach(form=>form.onsubmit=event=>{
      event.preventDefault(); action('grade',{examId:id,attemptId:form.dataset.grade,questionId:form.dataset.question,grade:new FormData(form).get('grade')},refresh)
    })
    return true
  }
  if (view === 'result') {
    const result=await examRequest('result',{examId:id})
    show(back+'<section class="panel form-panel"><h1>Your result</h1>'+
      (result.published ? result.scores.map(s=>`<p>Score <strong>${s.score} / ${s.total}</strong></p>`).join('') || '<p>No submitted attempt.</p>' : '<p>Your examiner has not published results yet.</p>')+
      (result.published && result.scores.length ? '<button class="primary" id="report">Download verified PDF report</button><p id="report-verification"></p>' : '')+'</section>')
    const reportButton=document.querySelector('#report')
    if(reportButton) reportButton.onclick=async()=>{
      try {
        const report=await examRequest('report',{examId:id})
        downloadReport(report)
        document.querySelector('#report-verification').innerHTML='<a target="_blank" rel="noopener" href="/?verify='+report.token+'">Verify this report</a>'
      }catch(error){notify(error.message,true)}
    }
    return true
  }
  return false
}

export async function examTools(id, {safe, notify}) {
  const heading=document.querySelector('.heading')
  heading.insertAdjacentHTML('afterend',`<div class="form-actions"><a class="button secondary" href="#monitor/${id}">Monitor and grade</a><a class="button secondary" href="#sandbox/${id}">Preview as candidate</a><a class="button secondary" href="#analytics/${id}">Question analytics</a><button class="secondary" id="exam-settings">Question bank and settings</button></div><div id="exam-tools"></div>`)
  document.querySelector('#exam-settings').onclick=async()=>{
    try {
      const [bank, detail]=await Promise.all([examRequest('bank'),examRequest('manage',{examId:id})])
      document.querySelector('#exam-tools').innerHTML=`<section class="panel form-panel"><h2>Draft settings</h2><p>Assigned questions are copied into the exam. Published questions stay locked.</p>
        <label class="flag"><input type="checkbox" id="randomize" ${detail.exam.randomize?'checked':''} ${detail.exam.published?'disabled':''}> Randomize question order</label>
        <p>Multiple-select questions require an exact match for full marks.</p>
        <label>Question bank<select id="bank-choice">${bank.map(q=>`<option value="${q.id}">${safe(q.prompt)} (${q.kind})</option>`).join('')}</select></label>
        <button class="secondary" id="assign" ${detail.exam.published||!bank.length?'disabled':''}>Add question to exam</button></section>`
      document.querySelector('#randomize').onchange=async event=>{
        try{await examRequest('settings',{examId:id,randomize:event.target.checked});notify('Settings saved.')}catch(e){notify(e.message,true)}
      }
      document.querySelector('#assign').onclick=async()=>{
        try{await examRequest('assign',{examId:id,questionId:document.querySelector('#bank-choice').value});notify('Question added.');location.reload()}catch(e){notify(e.message,true)}
      }
    }catch(e){notify(e.message,true)}
  }
}
