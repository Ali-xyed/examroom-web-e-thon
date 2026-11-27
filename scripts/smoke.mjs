import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'

const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, EXAMROOM_DEMO_PASSWORD: password } = process.env
assert.ok(url && key && password, 'Configure Supabase and the fictional demo password.')

async function post(path, body, token) {
  const headers = { apikey: key, 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const response = await fetch(url + path, {
    method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || data.msg || response.status)
  return data
}

async function actor(name) {
  const session = await post('/auth/v1/token?grant_type=password', {
    email: name === 'admin' ? (process.env.EXAMROOM_TEST_ADMIN_EMAIL || 'phase3-admin@examroom.example') : name + '@examroom.example', password,
  })
  return (operation, payload = {}) =>
    post('/rest/v1/rpc/examroom_request', { operation, payload }, session.access_token)
}

const [admin, examiner, candidate, visitor] = await Promise.all(
  ['admin', 'examiner', 'candidate', 'visitor'].map(actor),
)
const [administratorView, examinerView, candidateView] = await Promise.all(
  [admin('dashboard'), examiner('dashboard'), candidate('dashboard')],
)
assert.equal(administratorView.profile.role, 'administrator')
assert.equal(examinerView.profile.role, 'examiner')
assert.equal(candidateView.profile.role, 'candidate')
console.log('PASS: all three roles sign in')

const start = Date.parse(examinerView.serverTime)
function examData(label, opens, closes) {
  return {
    title: label + ' · ' + new Date(start).toISOString(), instructions: 'Select one answer.',
    opensAt: new Date(opens).toISOString(), closesAt: new Date(closes).toISOString(),
    duration: 5, questions: [{ prompt: 'Which number is prime?', choices: ['Eight', 'Nine', 'Seven', 'Ten'], correct: 2, marks: 1 }],
  }
}
await assert.rejects(candidate('create', examData('Unauthorized', start - 1000, start + 60000)))
const invalid = examData('Invalid', start - 1000, start + 60000)
invalid.questions[0].choices.pop()
await assert.rejects(examiner('create', invalid), /four choices/)
const { id: examId } = await examiner('create', examData('Phase 1 verification', start - 1000, start + 300000))
const payload = { examId }
await examiner('enroll', { examId, email: 'candidate@examroom.example' })
await assert.rejects(candidate('start', payload), /unavailable/i)
await examiner('publish', payload)
await assert.rejects(visitor('start', payload), /unavailable/i)
assert.ok(!(await visitor('dashboard')).exams.some(exam => exam.id === examId))
await assert.rejects(candidate('manage', payload), /unavailable/i)
console.log('PASS: backend validation, draft guard, enrollment guard, and role isolation')

const attempt = await candidate('start', payload)
assert.equal(attempt.questions.length, 1)
assert.ok(!('correct' in attempt.questions[0]))
const questionId = attempt.questions[0].id
await assert.rejects(candidate('save', { examId, questionId, choice: 4, flagged: true }))
await candidate('save', { examId, questionId, choice: 2, flagged: true })
const resumed = await candidate('start', payload)
assert.equal(resumed.deadline, attempt.deadline)
assert.equal(resumed.questions[0].choice, 2)
assert.equal(resumed.questions[0].flagged, true)
const [submit, repeated] = await Promise.all([candidate('submit', payload), candidate('submit', payload)])
assert.ok(submit.submittedAt)
assert.equal(repeated.submittedAt, submit.submittedAt)
await candidate('save', { examId, questionId, choice: 0, flagged: false })
assert.equal((await candidate('resume', payload)).questions[0].choice, 2)
assert.equal((await examiner('manage', payload)).candidates[0].submittedAt, submit.submittedAt)
console.log('PASS: server deadline, saved answer and flag, idempotent submission, and examiner roster')

const clock = Date.parse((await examiner('dashboard')).serverTime)
const shortExam = examData('Expiry verification', clock + 2500, clock + 10500)
const { id: shortId } = await examiner('create', shortExam)
const shortPayload = { examId: shortId }
await examiner('enroll', { examId: shortId, email: 'candidate@examroom.example' })
await examiner('publish', shortPayload)
await assert.rejects(candidate('start', shortPayload), /window/i)
await setTimeout(2700)
const shortAttempt = await candidate('start', shortPayload)
const shortQuestionId = shortAttempt.questions[0].id
await candidate('save', { ...shortPayload, questionId: shortQuestionId, choice: 1 })
await setTimeout(Math.max(0, Date.parse(shortAttempt.deadline) - Date.parse(shortAttempt.serverTime)) + 500)
const expired = await candidate('save', { ...shortPayload, questionId: shortQuestionId, choice: 3 })
assert.equal(expired.submittedAt, shortAttempt.deadline)
assert.equal((await candidate('resume', shortPayload)).questions[0].choice, 1)
console.log('PASS: early access denied and answers after the server cutoff rejected')
