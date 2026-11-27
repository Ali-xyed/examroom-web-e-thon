import { candidateDirectory } from './candidate-directory.js'
import { examRequest, hasSession, signIn, signOut } from './api.js'
import { phaseThree, verification, downloadReport, workspaceTools, readLocal, writeLocal, removeLocal } from './phase-three.js'
import { phaseTwo, examTools } from './phase-two.js'
import { authPanel, landing, landingNav, initLandingEffects } from './site.js'

const main = document.querySelector('#main')
const account = document.querySelector('#account')
const notice = document.querySelector('#notice')
const brand = document.querySelector('.top .brand')
const roles = { administrator: 'Administrator', examiner: 'Examiner', candidate: 'Candidate' }
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
let dashboard
let timer
let activeAttempt
let noticeTimer

function safe(value) {
  const element = document.createElement('span')
  element.textContent = value ?? ''
  return element.innerHTML.replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function date(value) { return dateFormat.format(new Date(value)) }

function notify(message, error = false) {
  clearTimeout(noticeTimer)
  notice.textContent = message
  notice.className = error ? 'error' : ''
  noticeTimer = setTimeout(() => { notice.textContent = '' }, 5500)
}

function show(html) {
  activeAttempt?.cleanup?.()
  clearInterval(timer)
  activeAttempt = null
  main.innerHTML = html
  main.setAttribute('aria-busy', 'false')
  window.scrollTo({top: 0, left: 0, behavior: 'instant'})
  main.focus({ preventScroll: true })
}

function currentRoute() {
  const [view, id] = location.hash.slice(1).split('/')
  return { view, id }
}

function navigate(path = '') {
  if (location.hash.slice(1) === path) void route()
  else location.hash = path
}

function bindForm(selector, handler) {
  document.querySelector(selector).addEventListener('submit', async event => {
    event.preventDefault()
    const form = event.currentTarget
    const button = event.submitter
    const errorSlot = form.querySelector('[data-error]')
    if (errorSlot) errorSlot.textContent = ''
    if (button) button.disabled = true
    try { await handler(new FormData(form), form) }
    catch (error) {
      if (errorSlot) errorSlot.textContent = error.message
      else notify(error.message, true)
    } finally { if (button) button.disabled = false }
  })
}

function login(message = '') {
  dashboard = null
  document.body.dataset.view = 'login'
  account.replaceChildren()
  show(`
    <section class="entry">
      <div class="login">
        <a class="auth-back" href="/"><span aria-hidden="true">←</span> Back</a>
        <div class="login-content">
          <div class="brand auth-brand"><img class="logo" src="/reference/uc-logo.png" alt=""> UnCooked</div>
          <h1>Welcome back</h1>
          <p class="muted">Use the credentials provided for your role.</p>
          <form id="login">
            <label>Email address<input type="email" name="email" placeholder="you@institution.edu" autocomplete="username" required></label>
            <div class="password-wrap">
              <label>Password<input id="password" type="password" name="password" placeholder="••••••••" autocomplete="current-password" required></label>
              <button type="button" id="password-toggle" aria-label="Show password" aria-controls="password"><span aria-hidden="true"></span></button>
            </div>
            <details class="auth-help"><summary>Forgot password?</summary><p>Contact your exam administrator to reset your credentials.</p></details>
            <p class="form-error" data-error role="alert">${safe(message)}</p>
            <button class="primary full" type="submit"><span aria-hidden="true">⇥</span> Sign in</button>
          </form>
        </div>
      </div>
      ${authPanel}
    </section>`)
  const password = document.querySelector('#password')
  const toggle = document.querySelector('#password-toggle')
  toggle.onclick = () => {
    const visible = password.type === 'password'
    password.type = visible ? 'text' : 'password'
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password')
    toggle.classList.toggle('revealed', visible)
  }
  bindForm('#login', async data => {
    await signIn(data.get('email').trim(), data.get('password'))
    await route()
  })
}

function showLanding() {
  document.body.dataset.view = 'landing'
  brand.insertAdjacentHTML('afterend', landingNav)
  account.innerHTML = hasSession()
    ? '<a class="button primary" href="/login">Open workspace</a>'
    : '<a class="button primary" href="/login">Log in</a>'
  show(landing())
  initLandingEffects()
  const tabs = [...main.querySelectorAll('[data-preview]')]
  const panels = [...main.querySelectorAll('[data-preview-panel]')]
  tabs.forEach(button => button.onclick = () => {
    for (const tab of tabs) {
      tab.classList.toggle('primary', tab === button)
      tab.setAttribute('aria-pressed', String(tab === button))
    }
    for (const panel of panels) panel.hidden = panel.dataset.previewPanel !== button.dataset.preview
  })
  const anchor = location.hash.slice(1)
  if (['how', 'demo', 'features'].includes(anchor)) document.getElementById(anchor).scrollIntoView()
}

function pageHeader(title, description, action = '') {
  return `<div class="heading"><div><h1>${safe(title)}</h1><p>${safe(description)}</p></div>${action}</div>`
}

function statusOf(exam, now) {
  if (!exam.published) return 'Draft'
  if (exam.submitted_at) return 'Completed'
  if (now < Date.parse(exam.opens_at)) return 'Upcoming'
  if (now >= Date.parse(exam.closes_at)) return 'Closed'
  return 'Ongoing'
}

async function home() {
  const { profile, exams, serverTime } = dashboard
  const now = Date.parse(serverTime)
  const examiner = profile.role === 'examiner'
  const candidate = profile.role === 'candidate'
  const title = candidate ? 'My examinations' : examiner ? 'Examinations' : 'Platform overview'
  const descriptions = {
    candidate: 'View your assigned examinations and their availability.',
    examiner: 'Create examinations, enroll candidates, and review attempts.',
    administrator: 'View examination activity across the platform.',
  }
  show(`${pageHeader(title, descriptions[profile.role], examiner ? '<a class="button primary" href="#create">New examination</a>' : '')}
    <div class="form-actions">${profile.role !== 'candidate' ? '<a class="button secondary" href="#import">Bulk import</a>' : ''}${await phaseTwo('',null,{show,safe,notify,profile})}</div><section class="exam-list" aria-label="Examinations">
    ${exams.length ? exams.map(exam => {
      const status = statusOf(exam, now)
      // An existing attempt can still be opened after the exam closes.
      const open = candidate && status !== 'Upcoming'
      const action = examiner ? '<a class="button secondary" href="#manage/' + exam.id + '">Manage exam</a>'
        : open ? '<a class="button primary" href="#take/' + exam.id + '">Open exam</a>' : ''
      return `<article class="panel exam-card">
        <div><span class="pill ${status.toLowerCase()}">${status}</span><h2>${safe(exam.title)}</h2>
        ${candidate && exam.instructions ? '<p class="exam-instructions">' + safe(exam.instructions) + '</p>' : ''}
        <dl class="metadata"><div><dt>Opens</dt><dd>${date(exam.opens_at)}</dd></div>
        <div><dt>Closes</dt><dd>${date(exam.closes_at)}</dd></div>
        <div><dt>Duration</dt><dd>${exam.duration} min</dd></div></dl></div><div class="exam-card-actions">${action}${candidate ? `<a class="button secondary" href="#result/${exam.id}">View result</a>` : ''}</div>
      </article>`
    }).join('') : '<p class="panel empty">No examinations to show.</p>'}
    </section>`)
}

function questionFields(index, q = {}) {
  const choices = Array.isArray(q.choices) ? q.choices : []
  return `<fieldset class="panel question-fields" data-inline-question><legend>Question ${index + 1}</legend>
    <label>Question text<textarea name="prompt" required maxlength="2000" rows="2">${safe(q.prompt || '')}</textarea></label>
    <div class="fields">
      ${['A', 'B', 'C', 'D'].map((letter, i) => `<label>Choice ${letter}<input name="choice" required maxlength="500" value="${safe(choices[i] || '')}"></label>`).join('')}
      <label>Correct choice<select name="correct">${['A','B','C','D'].map((letter, i) => `<option value="${i}" ${Number(q.correct) === i ? 'selected' : ''}>${letter}</option>`).join('')}</select></label>
      <label>Marks<input name="marks" type="number" required min="1" max="100" value="${q.marks || 1}"></label>
    </div>
    <button class="link-button remove-question" type="button">Remove question</button>
  </fieldset>`
}

function bankQuestionCard(index, q) {
  return `<fieldset class="panel question-fields bank-assigned-card" data-bank-id="${safe(q.id)}"><legend>Question ${index + 1} · From bank (${safe(q.kind)})</legend>
    <p class="bank-card-prompt"><strong>${safe(q.prompt)}</strong></p>
    <p class="muted">${safe(q.topic || 'General')} · ${safe(q.difficulty || 'easy')} · ${q.marks || 1} marks</p>
    <button class="link-button remove-question" type="button">Remove question</button>
  </fieldset>`
}

function inputDate(value) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

async function create() {
  const now = Date.parse(dashboard.serverTime)
  let bank = []
  try { bank = await examRequest('bank') } catch { bank = [] }
  show(`<nav class="breadcrumb" aria-label="Breadcrumb"><a class="back" href="#">← Back to Examinations</a><span aria-hidden="true">/</span><span>New examination</span></nav>
    ${pageHeader('New examination', 'Add the schedule, instructions, and questions — or drag questions from your Question Bank.')}
    <div class="create-grid">
      <form id="create">
        <section class="panel form-panel"><h2>Exam details</h2>
          <label>Title<input name="title" required maxlength="150"></label>
          <label>Candidate instructions<textarea name="instructions" maxlength="5000" rows="3"></textarea></label>
          <div class="fields">
            <label>Opens at<input type="datetime-local" name="opensAt" required value="${inputDate(new Date(now))}"></label>
            <label>Closes at<input type="datetime-local" name="closesAt" required value="${inputDate(new Date(now + 3600000))}"></label>
            <label>Duration in minutes<input name="duration" type="number" min="1" max="480" value="30" required></label>
          </div>
        </section>
        <div class="dropzone-hint muted" id="dropzone-hint">Drag questions from the Question Bank panel and drop them below, or add a blank question.</div>
        <div id="questions" class="questions-dropzone">${questionFields(0)}</div>
        <div class="form-actions"><button type="button" class="secondary" id="add-question">Add blank question</button>
          <p class="form-error" role="alert" data-error></p><button type="submit" class="primary">Save draft</button></div>
      </form>
      <aside class="panel form-panel bank-sidebar" aria-label="Question bank">
        <div class="bank-sidebar-header">
          <div><h2>Question bank</h2><p class="muted">Drag &amp; drop into the exam</p></div>
          <span class="status-badge">${bank.length}</span>
        </div>
        <label class="bank-sidebar-search">Filter questions<input id="bank-sidebar-filter" type="search" placeholder="Search topic, difficulty, text…"></label>
        <div id="bank-sidebar-list" class="bank-sidebar-list"></div>
      </aside>
    </div>`)
  const questions = document.querySelector('#questions')
  const sidebarList = document.querySelector('#bank-sidebar-list')
  const sidebarFilter = document.querySelector('#bank-sidebar-filter')

  function renumber() {
    const fields = [...questions.children]
    fields.forEach((field, index) => {
      const bankKind = field.dataset.bankId ? ' · From bank' : ''
      field.querySelector('legend').textContent = 'Question ' + (index + 1) + bankKind
      field.querySelector('.remove-question').disabled = fields.length === 1
    })
    document.querySelector('#add-question').disabled = fields.length >= 50
  }

  function isBlankStarter(field) {
    if (!field || !field.hasAttribute('data-inline-question')) return false
    const prompt = field.querySelector('[name="prompt"]')?.value.trim()
    const choices = [...field.querySelectorAll('[name="choice"]')].map(el => el.value.trim())
    return !prompt && choices.every(c => !c)
  }

  function appendBankQuestion(bankId) {
    const q = bank.find(item => item.id === bankId)
    if (!q) return
    if (questions.children.length >= 50) {
      notify('An examination can have at most 50 questions.', true)
      return
    }
    if (questions.children.length === 1 && isBlankStarter(questions.firstElementChild)) {
      questions.firstElementChild.remove()
    }
    const html = q.kind === 'single' ? questionFields(questions.children.length, q) : bankQuestionCard(questions.children.length, q)
    questions.insertAdjacentHTML('beforeend', html)
    renumber()
    notify('Added question from bank.')
  }

  function renderBankSidebar(term = '') {
    const needle = term.trim().toLowerCase()
    const filtered = bank.filter(q => (q.topic + ' ' + q.difficulty + ' ' + q.prompt).toLowerCase().includes(needle))
    sidebarList.innerHTML = filtered.length
      ? filtered.map(q => `<article class="bank-draggable" draggable="true" data-bank-item="${safe(q.id)}">
          <span class="drag-handle" aria-hidden="true">⋮⋮</span>
          <div class="bank-draggable-copy">
            <strong>${safe(q.prompt)}</strong>
            <span class="record-description">${safe(q.topic)} · ${safe(q.difficulty)} · ${safe(q.kind)} · ${q.marks}m</span>
          </div>
          <button type="button" class="secondary bank-add-btn" data-add-bank="${safe(q.id)}" aria-label="Add question to exam">＋ Add</button>
        </article>`).join('')
      : `<p class="empty-list">${bank.length ? 'No matching questions.' : 'No questions in Question Bank yet. <a href="#bank">Create some first</a>.'}</p>`
  }

  sidebarList.addEventListener('dragstart', event => {
    const item = event.target.closest('[data-bank-item]')
    if (!item) return
    event.dataTransfer.setData('text/plain', item.dataset.bankItem)
    event.dataTransfer.effectAllowed = 'copy'
    item.classList.add('dragging')
  })
  sidebarList.addEventListener('dragend', event => {
    event.target.closest('[data-bank-item]')?.classList.remove('dragging')
    questions.classList.remove('drop-active')
  })
  sidebarList.addEventListener('click', event => {
    const btn = event.target.closest('[data-add-bank]')
    if (btn) appendBankQuestion(btn.dataset.addBank)
  })
  sidebarFilter.oninput = event => renderBankSidebar(event.target.value)

  questions.addEventListener('dragover', event => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    questions.classList.add('drop-active')
  })
  questions.addEventListener('dragleave', event => {
    if (!questions.contains(event.relatedTarget)) questions.classList.remove('drop-active')
  })
  questions.addEventListener('drop', event => {
    event.preventDefault()
    questions.classList.remove('drop-active')
    const bankId = event.dataTransfer.getData('text/plain')
    if (bankId) appendBankQuestion(bankId)
  })

  document.querySelector('#add-question').onclick = () => {
    questions.insertAdjacentHTML('beforeend', questionFields(questions.children.length))
    renumber()
    questions.lastElementChild.querySelector('textarea').focus()
  }
  questions.onclick = event => {
    const button = event.target.closest('.remove-question')
    if (!button) return
    button.closest('fieldset').remove()
    renumber()
    document.querySelector('#add-question').focus()
  }
  renderBankSidebar()
  renumber()
  bindForm('#create', async data => {
    const opensAt = new Date(data.get('opensAt'))
    const closesAt = new Date(data.get('closesAt'))
    if (closesAt <= opensAt) throw new Error('Closing time must be after opening time.')
    const inlineCards = [...questions.querySelectorAll('[data-inline-question]')]
    const bankCards = [...questions.querySelectorAll('[data-bank-id]')]
    if (!inlineCards.length) {
      throw new Error('Include at least one single-answer question before saving the draft.')
    }
    const inlineQuestions = inlineCards.map(card => ({
      prompt: card.querySelector('[name="prompt"]').value,
      choices: [...card.querySelectorAll('[name="choice"]')].map(el => el.value),
      correct: Number(card.querySelector('[name="correct"]').value),
      marks: Number(card.querySelector('[name="marks"]').value),
    }))
    const result = await examRequest('create', {
      title: data.get('title'), instructions: data.get('instructions'), duration: Number(data.get('duration')),
      opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString(),
      questions: inlineQuestions,
    })
    for (const card of bankCards) {
      await examRequest('assign', { examId: result.id, questionId: card.dataset.bankId })
    }
    notify('Draft saved.')
    navigate('manage/' + result.id)
  })
}

function manage(id, data) {
  const { exam, candidates, questions } = data
  show(`<nav class="breadcrumb" aria-label="Breadcrumb"><a class="back" href="#">← Back to Examinations</a><span aria-hidden="true">/</span><span>${safe(exam.title)}</span></nav>
    ${pageHeader(exam.title, exam.published ? 'Published examination' : 'Draft examination',
      exam.published ? '' : '<button id="publish" class="primary" type="button">Publish exam</button>')}
    <div class="manage-grid"><section class="panel form-panel">
      <h2>Exam details</h2>
      <dl class="metadata"><div><dt>Opens</dt><dd>${date(exam.opens_at)}</dd></div>
        <div><dt>Closes</dt><dd>${date(exam.closes_at)}</dd></div>
        <div><dt>Duration</dt><dd>${exam.duration} min</dd></div>
        <div><dt>Total marks</dt><dd>${questions.reduce((sum, q) => sum + q.marks, 0)}</dd></div></dl>
      ${exam.instructions ? '<p class="exam-instructions">' + safe(exam.instructions) + '</p>' : ''}
      <h3>Questions</h3><ol class="question-summary">${questions.map(q => `<li><span>${safe(q.prompt)}</span><span>${q.marks} marks</span></li>`).join('')}</ol>
    </section><section class="panel form-panel"><h2>Candidates</h2>
      <form id="enroll"><div class="inline-form"><label>Candidate email<input name="email" type="email" required></label>
        <button type="submit" class="secondary">Enroll</button></div><p class="form-error" data-error role="alert"></p></form>
      <div id="candidate-directory"></div>
    </section></div>`)
  void candidateDirectory(id, {safe,notify})
  void examTools(id, {safe,notify})
  bindForm('#enroll', async data => {
    const fresh = await examRequest('enroll', { examId: id, email: data.get('email') })
    manage(id, fresh)
    notify('Candidate enrolled.')
  })
  const publish = document.querySelector('#publish')
  if (publish) publish.onclick = async () => {
    publish.disabled = true
    try {
      manage(id, await examRequest('publish', { examId: id }))
      notify('Exam published.')
    } catch (error) { notify(error.message, true) }
    finally { publish.disabled = false }
  }
}

function receipt(exam, submittedAt) {
  show(`<nav class="breadcrumb" aria-label="Breadcrumb"><a class="back" href="#">← Back to My examinations</a><span aria-hidden="true">/</span><span>Submission receipt</span></nav><section class="panel receipt">
    <span class="receipt-icon" aria-hidden="true">✓</span><h1>Attempt submitted</h1>
    <p>${safe(exam.title)}</p><p class="muted">Submission recorded at ${date(submittedAt)}.</p>
    <a class="button secondary" href="#">Back to examinations</a></section>`)
}

function take(id, data) {
  if (data.submittedAt) { removeLocal('pending-'+id); return receipt(data.exam, data.submittedAt) }
  const { exam, questions } = data
  const sandbox = Boolean(data.sandbox)
  data.cachedAt ??= Date.now()
  if (!sandbox) writeLocal('attempt-'+id, data)
  const pendingKey = 'pending-'+id
  const pending = sandbox ? {} : readLocal(pendingKey,{})
  for (const q of questions) { if (pending[q.id]) Object.assign(q,pending[q.id]) }
  const request = sandbox ? async (operation) => ({serverTime:new Date().toISOString(), submittedAt: operation === 'submit' ? new Date().toISOString() : null}) : examRequest
  const state = { id, sandbox, chain: Promise.resolve(), unsaved: new Map(), submitting: false, index: 0 }
  let remaining = Date.parse(data.deadline) - Date.parse(data.serverTime) - (data.offline ? Math.max(0,Date.now()-data.cachedAt) : 0)
  let synchronizedAt = performance.now()
  show(`<nav class="breadcrumb" aria-label="Breadcrumb"><a class="back" href="${sandbox ? '#manage/' + id : '#'}">← ${sandbox ? 'Back to Manage exam' : 'Back to My examinations'}</a><span aria-hidden="true">/</span><span>${safe(exam.title)}</span></nav>
    ${sandbox ? '<p class="pill">Examiner sandbox · Practice answers are local to this preview</p>' : ''}
    ${pageHeader(exam.title, exam.instructions || 'Answer the questions and submit before time expires.',
      '<div class="timer"><span>Time remaining</span><strong id="clock">--:--</strong></div>')}
    <div class="attempt-grid"><section class="panel form-panel" id="question"></section>
    <aside class="panel form-panel attempt-sidebar"><h2>Question navigator</h2>
      <p class="muted" id="progress"></p><div class="navigator" id="navigator"></div>
      <div class="legend"><span>Answered</span><span>Flagged</span></div>
      <div class="save-state" id="save-state" role="status">All changes saved</div>
      <button class="secondary full" id="retry" type="button" hidden>Retry saving</button>
      <button class="primary full" id="review" type="button">Review and submit</button>
    </aside></div>
    <dialog id="submit-dialog"><h2>Submit your attempt?</h2><p id="review-summary"></p>
      <div class="dialog-actions"><button id="continue" class="secondary" type="button">Keep working</button>
      <button id="submit" class="primary" type="button">Submit attempt</button></div>
    </dialog>`)
  activeAttempt = state
  document.querySelector('.attempt-sidebar').insertAdjacentHTML('beforeend', '<div id="announcements" aria-live="polite"></div>')
  workspaceTools(id,sandbox,notify)
  let nextPoll = 0
  const saveState = document.querySelector('#save-state')
  const retry = document.querySelector('#retry')
  const dialog = document.querySelector('#submit-dialog')
  function isAnswered(q) { return q.kind === 'written' ? Boolean(q.written.trim()) : q.kind === 'multiple' ? q.selected.length > 0 : q.choice !== null }
  function answered() { return questions.filter(isAnswered).length }
  function refreshNavigator() {
    document.querySelector('#progress').textContent = answered() + ' of ' + questions.length + ' answered'
    const nav = document.querySelector('#navigator')
    nav.innerHTML = questions.map((q, i) => `<button type="button" data-index="${i}"
      class="${isAnswered(q) ? 'answered' : ''} ${q.flagged ? 'flagged' : ''}"
      aria-current="${i === state.index ? 'step' : 'false'}"
      aria-label="Question ${i + 1}, ${isAnswered(q) ? 'answered' : 'unanswered'}${q.flagged ? ', flagged' : ''}">${i + 1}</button>`).join('')
  }
  function finalize(response) {
    if (!response.submittedAt) return false
    if (!sandbox && state.unsaved.size) notify('The attempt is finalized. Changes that were not synchronized before the deadline were not included.', true)
    if (!sandbox) removeLocal(pendingKey)
    if (sandbox) { show('<section class="panel form-panel"><h1>Sandbox complete</h1><p>This preview is complete.</p><a href="#manage/'+id+'">Back to exam</a></section>'); return true }
    receipt(exam, response.submittedAt)
    return true
  }
  function enqueue(q) {
    const revision = Math.max(Date.now(),readLocal('revision',0)+1)
    writeLocal('revision',revision)
    const snapshot = { revision, examId: id, questionId: q.id, choice: q.choice, flagged: q.flagged, selected: [...(q.selected || [])], written: q.written || '' }
    state.unsaved.set(q.id, snapshot)
    pending[q.id] = snapshot
    if (!sandbox) writeLocal('attempt-'+id, data)
    if (!sandbox && !writeLocal(pendingKey,pending)) notify('Local recovery storage is unavailable. Keep this page open until answers are saved.',true)
    saveState.textContent = navigator.onLine ? 'Saving changes…' : 'Offline · Answers pending synchronization'
    retry.hidden = true
    state.chain = state.chain.then(async () => {
      if (activeAttempt !== state || state.unsaved.get(q.id) !== snapshot) return
      try {
        const response = await request('save', snapshot)
        if (activeAttempt !== state || finalize(response)) return
        if (response.stale && state.unsaved.get(q.id) === snapshot) {
          const fresh = await request('resume', {examId:id})
          if (activeAttempt !== state || finalize(fresh)) return
          Object.assign(q, fresh.questions.find(question => question.id === q.id))
          displayQuestion(state.index)
          notify('A newer answer was already accepted. The workspace now shows the accepted answer.')
        }
        remaining = Date.parse(data.deadline) - Date.parse(response.serverTime)
        synchronizedAt = performance.now()
        data.serverTime = response.serverTime
        data.cachedAt = Date.now()
        if (!sandbox) writeLocal('attempt-'+id,data)
        if (state.unsaved.get(q.id) === snapshot) { state.unsaved.delete(q.id); delete pending[q.id]; if (!sandbox) writeLocal(pendingKey,pending) }
        if (!state.unsaved.size) saveState.textContent = sandbox ? 'Preview changes saved locally' : 'All changes saved'
      } catch {
        saveState.textContent = navigator.onLine ? 'Saving failed · Answers pending synchronization' : 'Offline · Answers pending synchronization'
        retry.hidden = false
      }
    })
  }
  function displayQuestion(index, focus = false) {
    state.index = index
    const q = questions[index]
    const section = document.querySelector('#question')
    section.innerHTML = `<div class="question-meta"><span>Question ${index + 1} of ${questions.length}</span><span>${q.marks} marks</span></div>
      <fieldset class="choices"><legend tabindex="-1">${safe(q.prompt)}</legend>
      ${q.kind === 'written' ? `<label>Written answer<textarea id="written" maxlength="20000" rows="8">${safe(q.written)}</textarea></label>` : q.choices.map((choice, i) => `<label class="choice"><input type="${q.kind === 'multiple' ? 'checkbox' : 'radio'}" name="answer" value="${i}" ${(q.kind === 'multiple' ? q.selected.includes(i) : q.choice === i) ? 'checked' : ''}>
      <span class="letter">${'ABCD'[i]}</span><span>${safe(choice)}</span></label>`).join('')}</fieldset>
      <div class="question-tools"><button type="button" class="link-button" id="clear-answer" ${!isAnswered(q) ? 'disabled' : ''}>Clear answer</button>
      <label class="flag"><input type="checkbox" id="flag" ${q.flagged ? 'checked' : ''}> Mark for review</label></div>
      <div class="question-actions"><button type="button" class="secondary" id="previous" ${index === 0 ? 'disabled' : ''}>Previous question</button>
      <button type="button" class="secondary" id="next" ${index === questions.length - 1 ? 'disabled' : ''}>Next question</button></div>`
    const clear = section.querySelector('#clear-answer')
    section.querySelectorAll('[name=answer]').forEach(input => input.onchange = () => {
      if (q.kind === 'multiple') q.selected = [...section.querySelectorAll('[name=answer]:checked')].map(el => Number(el.value))
      else q.choice = Number(input.value)
      clear.disabled = !isAnswered(q); refreshNavigator(); enqueue(q)
    })
    const written = section.querySelector('#written')
    if (written) written.oninput = () => { q.written = written.value; clear.disabled = !isAnswered(q); refreshNavigator(); enqueue(q) }
    clear.onclick = () => {
      q.choice = null; q.selected = []; q.written = ''; enqueue(q); displayQuestion(index)
      section.querySelector('legend').focus()
    }
    section.querySelector('#flag').onchange = event => {
      q.flagged = event.target.checked; refreshNavigator(); enqueue(q)
    }
    section.querySelector('#previous').onclick = () => displayQuestion(index - 1, true)
    section.querySelector('#next').onclick = () => displayQuestion(index + 1, true)
    refreshNavigator()
    if (focus) section.querySelector('legend').focus()
  }
  document.querySelector('#navigator').onclick = event => {
    const button = event.target.closest('[data-index]')
    if (button) displayQuestion(Number(button.dataset.index), true)
  }
  retry.onclick = () => questions.filter(q => state.unsaved.has(q.id)).forEach(enqueue)
  document.querySelector('#review').onclick = () => {
    document.querySelector('#review-summary').textContent =
      answered() + ' of ' + questions.length + ' answered. ' +
      questions.filter(q => q.flagged).length + ' marked for review.'
    dialog.showModal()
  }
  document.querySelector('#continue').onclick = () => dialog.close()
  document.querySelector('#submit').onclick = async event => {
    const button = event.currentTarget
    button.disabled = true
    state.submitting = true
    try {
      await state.chain
      if (activeAttempt !== state) return
      if (state.unsaved.size) throw new Error('Retry saving your pending changes before submitting.')
      finalize(await request('submit', { examId: id }))
    } catch (error) {
      dialog.close()
      notify(error.message, true)
    } finally { state.submitting = false; button.disabled = false }
  }
  const clock = document.querySelector('#clock')
  let checkingExpiry = false
  async function tick() {
    if (!sandbox && performance.now() > nextPoll) {
      nextPoll = performance.now() + 10000
      examRequest('announcements', {examId:id}).then(items => {
        if (activeAttempt === state) document.querySelector('#announcements').innerHTML = items.map(item => '<p>' + safe(item.message) + '</p>').join('')
      }).catch(() => {})
    }
    const seconds = Math.max(0, Math.ceil((remaining - (performance.now() - synchronizedAt)) / 1000))
    clock.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
    document.querySelector('#question').inert = seconds === 0
    clock.classList.toggle('low', seconds < 60)
    if (seconds || checkingExpiry || state.submitting) return
    checkingExpiry = true
    try {
      const fresh = sandbox ? {submittedAt:new Date().toISOString()} : await request('resume', { examId: id })
      if (activeAttempt === state && !finalize(fresh)) {
        remaining = Date.parse(fresh.deadline) - Date.parse(fresh.serverTime)
        synchronizedAt = performance.now()
      }
    } catch {
      saveState.textContent = 'Time expired. Reconnecting to confirm your submission…'
    } finally { setTimeout(() => { checkingExpiry = false }, 3000) }
  }
  displayQuestion(0)
  const reconnect = () => { if (activeAttempt === state) questions.filter(q => pending[q.id]).forEach(enqueue) }
  const connectionLost = () => {
    if (activeAttempt === state && !sandbox) saveState.textContent = 'Offline · Changes stay on this browser until synchronized'
  }
  addEventListener('online',reconnect)
  addEventListener('offline',connectionLost)
  state.cleanup = () => { removeEventListener('online',reconnect); removeEventListener('offline',connectionLost) }
  reconnect()
  void tick()
  timer = setInterval(tick, 1000)
}

function renderWorkspaceBar(profile, view) {
  let bar = document.querySelector('#workspace-bar')
  if (!bar) {
    document.querySelector('.top')?.insertAdjacentHTML('afterend', '<div id="workspace-bar" class="workspace-bar"></div>')
    bar = document.querySelector('#workspace-bar')
  }
  const navItems = profile.role === 'examiner'
    ? [['', 'Examinations'], ['bank', 'Question bank'], ['create', 'New examination'], ['import', 'Bulk import']]
    : profile.role === 'administrator'
      ? [['', 'Overview'], ['users', 'Manage users'], ['import', 'Bulk import']]
      : [['', 'My examinations']]
  const activeView = view || ''
  const online = navigator.onLine
  bar.innerHTML = `<div class="workspace-bar-inner">
    <nav class="workspace-nav" aria-label="Workspace navigation">
      ${navItems.map(([href, label]) => {
        const isCurrent = activeView === href || (href === '' && ['manage', 'monitor', 'analytics', 'result', 'take', 'sandbox'].includes(activeView))
        return `<a href="#${href}" class="workspace-link ${isCurrent ? 'active' : ''}" ${isCurrent ? 'aria-current="page"' : ''}>${label}</a>`
      }).join('')}
    </nav>
    <div class="workspace-status" role="status" aria-live="polite">
      <span class="conn-dot ${online ? 'online' : 'offline'}" aria-hidden="true"></span>
      <span>${online ? 'Connected' : 'Offline'}</span>
    </div>
  </div>`
}

let routeVersion = 0
async function route() {
  const version = ++routeVersion
  if (!hasSession()) {
    document.querySelector('#workspace-bar')?.remove()
    return login()
  }
  const { view, id } = currentRoute()
  const operations = { manage: 'manage', take: 'start' }
  try {
    main.setAttribute('aria-busy', 'true')
    const info = await examRequest('dashboard')
    if (version !== routeVersion) return
    dashboard = info
    document.body.dataset.view = 'workspace'
    brand.href = '/login'
    const { profile } = dashboard
    account.innerHTML = `<div class="account-label"><strong>${safe(profile.name)}</strong>
      <span>${roles[profile.role]}</span></div><button class="secondary" id="logout" type="button">Sign out</button>`
    document.querySelector('#logout').onclick = async () => {
      await signOut()
      navigate()
    }
    renderWorkspaceBar(profile, view)
    if (['sandbox','analytics','import'].includes(view)) { await phaseThree(view,id,{show,safe,notify,profile,take}); return }
    if (['users','bank','monitor','result'].includes(view)) { await phaseTwo(view,id,{show,safe,notify,profile}); return }
    if (view === 'create' && profile.role === 'examiner') return create()
    if ((view === 'manage' && profile.role === 'examiner') || (view === 'take' && profile.role === 'candidate')) {
      if (!id || !/^[\da-f-]{36}$/i.test(id)) throw new Error('Exam unavailable.')
      const data = await examRequest(operations[view], { examId: id })
      if (version !== routeVersion) return
      return view === 'manage' ? manage(id, data) : take(id, data)
    }
    home()
  } catch (error) {
    if (version !== routeVersion) return
    const cached = view === 'take' && readLocal('attempt-'+id,null)
    if (!navigator.onLine && cached && hasSession()) { take(id,{...cached,offline:true}); return }
    if (!hasSession()) login()
    else if (dashboard && view) { await home(); notify(error.message, true) }
    else {
      document.body.dataset.view = 'workspace'
      show(`<section class="panel empty"><h1>Could not open UnCooked</h1><p>${safe(error.message)}</p>
        <button class="primary" id="reload" type="button">Try again</button>
        <button class="secondary" id="switch-account" type="button">Sign in with another account</button></section>`)
      document.querySelector('#switch-account').onclick = async () => {
        await signOut()
        history.replaceState(null, '', '/login')
        login()
      }
    }
    document.querySelector('#reload')?.addEventListener('click', route)
  }
}

addEventListener('session-ended', event => {
  routeVersion++
  history.replaceState(null, '', '/login')
  login(event.detail)
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && activeAttempt && !activeAttempt.sandbox) examRequest('incident', {examId:activeAttempt.id,event:'page_hidden'}).catch(() => {})
})
addEventListener('beforeunload', event => {
  if (activeAttempt?.unsaved.size) event.preventDefault()
})
const verificationCode = new URLSearchParams(location.search).get('verify')
if (verificationCode) {
  verification(verificationCode,show,safe).catch(error => show('<p>'+safe(error.message)+'</p>'))
} else if (location.pathname === '/' && !/^#(?:create$|manage\/|take\/)/.test(location.hash)) {
  showLanding()
} else {
  if (location.pathname === '/') history.replaceState(null, '', '/login' + location.hash)
  addEventListener('hashchange', route)
  void route()
}

function updateConnectionStatus() {
  const status = document.querySelector('#workspace-bar .workspace-status')
  if (!status) return
  const online = navigator.onLine
  status.innerHTML = `<span class="conn-dot ${online ? 'online' : 'offline'}" aria-hidden="true"></span><span>${online ? 'Connected' : 'Offline'}</span>`
}
addEventListener('online', updateConnectionStatus)
addEventListener('offline', updateConnectionStatus)

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', {updateViaCache:'none'}).catch(() => {})
