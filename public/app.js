import { examRequest, hasSession, signIn, signOut } from './api.js'
import { authPanel, landing, landingNav } from './site.js'

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
  clearInterval(timer)
  activeAttempt = null
  main.innerHTML = html
  main.setAttribute('aria-busy', 'false')
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

function login() {
  document.body.dataset.view = 'login'
  account.replaceChildren()
  show(`
    <section class="entry">
      <div class="login">
        <a class="auth-back" href="/"><span aria-hidden="true">←</span> Back</a>
        <div class="login-content">
          <div class="brand auth-brand"><span class="logo" aria-hidden="true">E</span> Examroom</div>
          <h1>Welcome back</h1>
          <p class="muted">Use the credentials provided for your role.</p>
          <form id="login">
            <label>Email address<input type="email" name="email" placeholder="you@institution.edu" autocomplete="username" required></label>
            <div class="password-wrap">
              <label>Password<input id="password" type="password" name="password" placeholder="••••••••" autocomplete="current-password" required></label>
              <button type="button" id="password-toggle" aria-label="Show password" aria-controls="password"><span aria-hidden="true"></span></button>
            </div>
            <details class="auth-help"><summary>Forgot password?</summary><p>Contact your exam administrator to reset your credentials.</p></details>
            <p class="form-error" data-error role="alert"></p>
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
  if (now < Date.parse(exam.opens_at)) return 'Upcoming'
  if (now >= Date.parse(exam.closes_at)) return 'Closed'
  return 'Available'
}

function home() {
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
    <section class="exam-list" aria-label="Examinations">
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
        <div><dt>Duration</dt><dd>${exam.duration} min</dd></div></dl></div>${action}
      </article>`
    }).join('') : '<p class="panel empty">No examinations to show.</p>'}
    </section>`)
}

function questionFields(index) {
  return `<fieldset class="panel question-fields"><legend>Question ${index + 1}</legend>
    <label>Question text<textarea name="prompt" required maxlength="2000" rows="2"></textarea></label>
    <div class="fields">
      ${['A', 'B', 'C', 'D'].map(letter => `<label>Choice ${letter}<input name="choice" required maxlength="500"></label>`).join('')}
      <label>Correct choice<select name="correct">${['A','B','C','D'].map((letter, i) => `<option value="${i}">${letter}</option>`).join('')}</select></label>
      <label>Marks<input name="marks" type="number" required min="1" max="100" value="1"></label>
    </div>
    <button class="link-button remove-question" type="button">Remove question</button>
  </fieldset>`
}

function inputDate(value) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function create() {
  const now = Date.parse(dashboard.serverTime)
  show(`<a class="back" href="#">Examinations</a>
    ${pageHeader('New examination', 'Add the schedule, instructions, and questions before you publish.')}
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
      <div id="questions">${questionFields(0)}</div>
      <div class="form-actions"><button type="button" class="secondary" id="add-question">Add question</button>
        <p class="form-error" role="alert" data-error></p><button type="submit" class="primary">Save draft</button></div>
    </form>`)
  const questions = document.querySelector('#questions')
  function renumber() {
    const fields = [...questions.children]
    fields.forEach((field, index) => {
      field.querySelector('legend').textContent = 'Question ' + (index + 1)
      field.querySelector('button').disabled = fields.length === 1
    })
    document.querySelector('#add-question').disabled = fields.length >= 50
  }
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
  renumber()
  bindForm('#create', async data => {
    const opensAt = new Date(data.get('opensAt'))
    const closesAt = new Date(data.get('closesAt'))
    if (closesAt <= opensAt) throw new Error('Closing time must be after opening time.')
    const choices = data.getAll('choice')
    const correct = data.getAll('correct')
    const marks = data.getAll('marks')
    const result = await examRequest('create', {
      title: data.get('title'), instructions: data.get('instructions'), duration: Number(data.get('duration')),
      opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString(),
      questions: data.getAll('prompt').map((prompt, index) => ({
        prompt, choices: choices.slice(index * 4, index * 4 + 4), correct: Number(correct[index]), marks: Number(marks[index]),
      })),
    })
    notify('Draft saved.')
    navigate('manage/' + result.id)
  })
}

function manage(id, data) {
  const { exam, candidates, questions } = data
  show(`<a class="back" href="#">Examinations</a>
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
      ${candidates.length ? '<ul class="roster">' + candidates.map(candidate => `
        <li><div><strong>${safe(candidate.name)}</strong><small>${safe(candidate.email)}</small></div>
        <div><span class="pill ${candidate.submittedAt ? 'available' : ''}">${candidate.submittedAt ? 'Submitted' : candidate.startedAt ? 'In progress' : 'Enrolled'}</span>
        ${candidate.submittedAt ? '<small>' + date(candidate.submittedAt) + '</small>' : ''}</div></li>`).join('') + '</ul>'
        : '<p class="muted">No candidates enrolled.</p>'}
    </section></div>`)
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
  show(`<a class="back" href="#">My examinations</a><section class="panel receipt">
    <span class="receipt-icon" aria-hidden="true">✓</span><h1>Attempt submitted</h1>
    <p>${safe(exam.title)}</p><p class="muted">Submission recorded at ${date(submittedAt)}.</p>
    <a class="button secondary" href="#">Back to examinations</a></section>`)
}

function take(id, data) {
  if (data.submittedAt) return receipt(data.exam, data.submittedAt)
  const { exam, questions } = data
  const state = { id, chain: Promise.resolve(), unsaved: new Map(), submitting: false, index: 0 }
  let remaining = Date.parse(data.deadline) - Date.parse(data.serverTime)
  let synchronizedAt = performance.now()
  show(`<a class="back" href="#">My examinations</a>
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
  const saveState = document.querySelector('#save-state')
  const retry = document.querySelector('#retry')
  const dialog = document.querySelector('#submit-dialog')
  function answered() { return questions.filter(q => q.choice !== null).length }
  function refreshNavigator() {
    document.querySelector('#progress').textContent = answered() + ' of ' + questions.length + ' answered'
    const nav = document.querySelector('#navigator')
    nav.innerHTML = questions.map((q, i) => `<button type="button" data-index="${i}"
      class="${q.choice !== null ? 'answered' : ''} ${q.flagged ? 'flagged' : ''}"
      aria-current="${i === state.index ? 'step' : 'false'}"
      aria-label="Question ${i + 1}, ${q.choice === null ? 'unanswered' : 'answered'}${q.flagged ? ', flagged' : ''}">${i + 1}</button>`).join('')
  }
  function finalize(response) {
    if (!response.submittedAt) return false
    receipt(exam, response.submittedAt)
    return true
  }
  function enqueue(q) {
    const snapshot = { examId: id, questionId: q.id, choice: q.choice, flagged: q.flagged }
    state.unsaved.set(q.id, snapshot)
    saveState.textContent = 'Saving changes…'
    retry.hidden = true
    state.chain = state.chain.then(async () => {
      if (activeAttempt !== state || state.unsaved.get(q.id) !== snapshot) return
      try {
        const response = await examRequest('save', snapshot)
        if (activeAttempt !== state || finalize(response)) return
        remaining = Date.parse(data.deadline) - Date.parse(response.serverTime)
        synchronizedAt = performance.now()
        if (state.unsaved.get(q.id) === snapshot) state.unsaved.delete(q.id)
        if (!state.unsaved.size) saveState.textContent = 'All changes saved'
      } catch {
        saveState.textContent = 'Some changes could not be saved.'
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
      ${q.choices.map((choice, i) => `<label class="choice"><input type="radio" name="answer" value="${i}" ${q.choice === i ? 'checked' : ''}>
      <span class="letter">${'ABCD'[i]}</span><span>${safe(choice)}</span></label>`).join('')}</fieldset>
      <div class="question-tools"><button type="button" class="link-button" id="clear-answer" ${q.choice === null ? 'disabled' : ''}>Clear answer</button>
      <label class="flag"><input type="checkbox" id="flag" ${q.flagged ? 'checked' : ''}> Mark for review</label></div>
      <div class="question-actions"><button type="button" class="secondary" id="previous" ${index === 0 ? 'disabled' : ''}>Previous question</button>
      <button type="button" class="secondary" id="next" ${index === questions.length - 1 ? 'disabled' : ''}>Next question</button></div>`
    const clear = section.querySelector('#clear-answer')
    section.querySelectorAll('[name=answer]').forEach(input => input.onchange = () => {
      q.choice = Number(input.value); clear.disabled = false; refreshNavigator(); enqueue(q)
    })
    clear.onclick = () => {
      q.choice = null; enqueue(q); displayQuestion(index)
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
      finalize(await examRequest('submit', { examId: id }))
    } catch (error) {
      dialog.close()
      notify(error.message, true)
    } finally { state.submitting = false; button.disabled = false }
  }
  const clock = document.querySelector('#clock')
  let checkingExpiry = false
  async function tick() {
    const seconds = Math.max(0, Math.ceil((remaining - (performance.now() - synchronizedAt)) / 1000))
    clock.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
    clock.classList.toggle('low', seconds < 60)
    if (seconds || checkingExpiry || state.submitting) return
    checkingExpiry = true
    try {
      const fresh = await examRequest('resume', { examId: id })
      if (activeAttempt === state && !finalize(fresh)) {
        remaining = Date.parse(fresh.deadline) - Date.parse(fresh.serverTime)
        synchronizedAt = performance.now()
      }
    } catch {
      saveState.textContent = 'Time expired. Reconnecting to confirm your submission…'
    } finally { setTimeout(() => { checkingExpiry = false }, 3000) }
  }
  displayQuestion(0)
  void tick()
  timer = setInterval(tick, 1000)
}

let routeVersion = 0
async function route() {
  const version = ++routeVersion
  if (!hasSession()) return login()
  const { view, id } = currentRoute()
  const operations = { manage: 'manage', take: 'start' }
  try {
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
    if (!hasSession()) login()
    else if (dashboard && view) { home(); notify(error.message, true) }
    else show(`<section class="panel empty"><h1>Could not open Examroom</h1><p>${safe(error.message)}</p>
      <button class="primary" id="reload" type="button">Try again</button></section>`)
    document.querySelector('#reload')?.addEventListener('click', route)
  }
}

addEventListener('beforeunload', event => {
  if (activeAttempt?.unsaved.size) event.preventDefault()
})
if (location.pathname === '/' && !/^#(?:create$|manage\/|take\/)/.test(location.hash)) {
  showLanding()
} else {
  if (location.pathname === '/') history.replaceState(null, '', '/login' + location.hash)
  addEventListener('hashchange', route)
  void route()
}
