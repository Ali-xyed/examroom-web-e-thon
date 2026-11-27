import { manageUsers } from './users.js'
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
    await manageUsers({show,safe,notify})
    return true
  }
  if (view === 'bank') {
    const bank = await examRequest('bank')
    show(`<nav class="breadcrumb" aria-label="Breadcrumb"><a class="back" href="#">← Back to Examinations</a><span aria-hidden="true">/</span><span>Question bank</span></nav>
      <div class="heading"><div><h1>Question bank</h1><p>Create reusable questions and organize them by topic and difficulty.</p></div>
        <span class="status-badge" role="status">${bank.length} ${bank.length === 1 ? 'question' : 'questions'} in bank</span></div>
      <div id="bank-editor"></div>
      <div class="panel form-panel"><label>Filter by topic, difficulty, or question text<input id="filter" type="search" placeholder="Search questions…"></label><div id="bank-list"></div></div>
      <dialog class="account-dialog bank-dialog" id="bank-edit-dialog" aria-labelledby="bank-edit-title">
        <div class="account-dialog-heading">
          <div><h2 id="bank-edit-title">Edit question</h2><p id="bank-edit-subtitle">Update the question details and save your changes.</p></div>
          <button class="account-close secondary" type="button" id="close-bank-edit" aria-label="Close edit question dialog">×</button>
        </div>
        <form id="bank-edit-form">
          <div class="account-fields" id="bank-edit-fields"></div>
          <p id="bank-edit-error" class="form-error" role="alert"></p>
          <div class="account-footer">
            <button class="secondary" id="cancel-bank-edit" type="button">Cancel</button>
            <button class="primary" id="save-bank-edit" type="submit">Save changes</button>
          </div>
        </form>
      </dialog>`)

    function questionFormFields(q = {}) {
      return `<label>Question<textarea name="prompt" required maxlength="2000">${safe(q.prompt)}</textarea></label>
        <div class="fields"><label>Type<select name="kind">${[['single','Single-answer MCQ'],['multiple','Multiple-select MCQ'],['written','Written response']].map(([kind,label]) => `<option value="${kind}" ${q.kind===kind?'selected':''}>${label}</option>`).join('')}</select></label>
        <label>Topic<input name="topic" required maxlength="100" value="${safe(q.topic || 'General')}"></label>
        <label>Difficulty<select name="difficulty">${['easy','medium','hard'].map(d => `<option ${q.difficulty===d?'selected':''}>${d}</option>`).join('')}</select></label>
        <label>Marks<input name="marks" type="number" min="1" max="100" value="${q.marks || 1}" required></label></div>
        <p class="muted" data-marking-help></p>
        <fieldset data-question-types="single multiple"><legend>Answer choices</legend><div class="fields">${['A','B','C','D'].map((letter,i) => `<label>Choice ${letter}<input name="choice" maxlength="500" value="${safe(q.kind === 'written' ? '' : q.choices?.[i] || '')}"></label>`).join('')}</div></fieldset>
        <label data-question-types="single">Correct answer<select name="correct">${['A','B','C','D'].map((letter,i) => `<option value="${i}" ${q.correct===i?'selected':''}>${letter}</option>`).join('')}</select></label>
        <fieldset data-question-types="multiple"><legend>Correct answers</legend>${['A','B','C','D'].map((letter,i) => `<label class="flag"><input type="checkbox" name="correctSet" value="${i}" ${q.correct_set?.includes(i)?'checked':''}>${letter}</label>`).join('')}</fieldset>`
    }

    function bindQuestionForm(form, q, onSubmit) {
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
        form.querySelector('[data-marking-help]').textContent = {
          single: 'Enter four choices and select one correct answer.',
          multiple: 'Enter four choices and select the correct answers. Candidates must select exactly those answers for full marks.',
          written: 'Candidates enter a written response. The examiner grades it up to the assigned marks.',
        }[type.value]
        validateCorrectChoices()
      }
      type.onchange = updateQuestionType
      correctChoices.forEach(input => input.onchange = validateCorrectChoices)
      updateQuestionType()
      form.onsubmit = async event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const payload = Object.fromEntries(data)
        payload.id = q.id
        payload.choices = payload.kind === 'written' ? ['Unused 0','Unused 1','Unused 2','Unused 3'] : data.getAll('choice')
        payload.correct = payload.kind === 'single' ? Number(data.get('correct')) : 0
        payload.correctSet = payload.kind === 'multiple' ? data.getAll('correctSet').map(Number) : []
        await onSubmit(payload)
      }
    }

    function renderNewForm() {
      document.querySelector('#bank-editor').innerHTML = `<form class="panel form-panel"><h2>New question</h2>
        ${questionFormFields()}
        <div class="form-actions"><button class="primary" type="submit">Save question</button><button class="secondary" type="button" id="reset-bank">Clear form</button></div></form>`
      const form = document.querySelector('#bank-editor form')
      document.querySelector('#reset-bank').onclick = () => renderNewForm()
      bindQuestionForm(form, {}, async payload => {
        const btn = form.querySelector('button[type="submit"]')
        btn.disabled = true
        btn.textContent = 'Saving…'
        try {
          await examRequest('bank_save', payload)
          notify('Question added to bank.')
          await phaseTwo(view, id, {show, safe, notify, profile})
        } catch (error) {
          notify(error.message, true)
          btn.disabled = false
          btn.textContent = 'Save question'
        }
      })
    }

    const editDialog = document.querySelector('#bank-edit-dialog')
    const editForm = document.querySelector('#bank-edit-form')
    const editFields = document.querySelector('#bank-edit-fields')
    const editError = document.querySelector('#bank-edit-error')
    const saveEditBtn = document.querySelector('#save-bank-edit')
    let editBusy = false
    let editOpener = null

    function closeEditDialog() {
      if (editBusy) return
      editDialog.close()
      editForm.reset()
      editFields.replaceChildren()
      editError.textContent = ''
      if (editOpener?.isConnected) editOpener.focus({preventScroll: true})
    }
    editDialog.addEventListener('cancel', event => { event.preventDefault(); closeEditDialog() })
    document.querySelector('#close-bank-edit').onclick = closeEditDialog
    document.querySelector('#cancel-bank-edit').onclick = closeEditDialog

    function openEditModal(q, trigger) {
      editOpener = trigger
      editError.textContent = ''
      document.querySelector('#bank-edit-subtitle').textContent = `${q.topic || 'General'} · ${q.difficulty || 'easy'} · ${q.marks || 1} marks`
      editFields.innerHTML = questionFormFields(q)
      bindQuestionForm(editForm, q, async payload => {
        if (editBusy) return
        editBusy = true
        saveEditBtn.textContent = 'Saving…'
        editDialog.querySelectorAll('button, input, select, textarea').forEach(el => { el.disabled = true })
        try {
          await examRequest('bank_save', payload)
          editBusy = false
          closeEditDialog()
          notify('Question updated.')
          await phaseTwo(view, id, {show, safe, notify, profile})
        } catch (error) {
          editError.textContent = error.message
        } finally {
          editBusy = false
          editDialog.querySelectorAll('button, input, select, textarea').forEach(el => { el.disabled = false })
          saveEditBtn.textContent = 'Save changes'
        }
      })
      editDialog.showModal()
      editForm.elements.prompt.focus()
    }

    function list(filter = '') {
      document.querySelector('#bank-list').innerHTML = bank.filter(q => (q.topic+' '+q.difficulty+' '+q.prompt).toLowerCase().includes(filter.toLowerCase()))
        .map(q => `<article class="record-row"><div class="record-copy"><strong>${safe(q.prompt)}</strong><span class="record-description">${safe(q.topic)} · ${q.difficulty} · ${q.kind} · ${q.marks} marks</span></div><button type="button" class="secondary" data-edit="${q.id}">Edit</button></article>`).join('') || '<p class="empty-list">No questions match your search.</p>'
      document.querySelectorAll('[data-edit]').forEach(button => {
        button.onclick = () => openEditModal(bank.find(q => q.id === button.dataset.edit), button)
      })
    }

    renderNewForm(); list()
    document.querySelector('#filter').oninput = event => list(event.target.value)
    return true
  }
  if (view === 'monitor') {
    const data = await examRequest('monitor',{examId:id})
    show(`<nav class="breadcrumb" aria-label="Breadcrumb"><a class="back" href="#manage/${id}">← Back to Manage exam</a><span aria-hidden="true">/</span><span>Monitor and grade</span></nav>
      <h1>Monitor and grade</h1><p>Incidents are signals for review. They do not establish misconduct.</p>
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
      try { await downloadReport(await examRequest('report',{examId:id})) } catch(error) { notify(error.message,true) }
    }
    document.querySelectorAll('[data-grade]').forEach(form=>form.onsubmit=event=>{
      event.preventDefault(); action('grade',{examId:id,attemptId:form.dataset.grade,questionId:form.dataset.question,grade:new FormData(form).get('grade')},refresh)
    })
    return true
  }
  if (view === 'result') {
    const result=await examRequest('result',{examId:id})
    show(`<nav class="breadcrumb" aria-label="Breadcrumb"><a class="back" href="#">← Back to My examinations</a><span aria-hidden="true">/</span><span>Result</span></nav><section class="panel form-panel"><h1>Your result</h1>`+
      (result.published ? result.scores.map(s=>`<p>Score <strong>${s.score} / ${s.total}</strong></p>`).join('') || '<p>No submitted attempt.</p>' : '<p>Your examiner has not published results yet.</p>')+
      (result.published && result.scores.length ? '<button class="primary" id="report">Download verified PDF report</button><p id="report-verification"></p>' : '')+'</section>')
    const reportButton=document.querySelector('#report')
    if(reportButton) reportButton.onclick=async()=>{
      try {
        const report=await examRequest('report',{examId:id})
        await downloadReport(report)
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
