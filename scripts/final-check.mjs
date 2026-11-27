import assert from 'node:assert/strict'
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY
const password = process.env.EXAMROOM_DEMO_PASSWORD
async function post(path, body, token) {
  const response = await fetch(url+path, {
    method:'POST', headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    body:JSON.stringify(body), signal:AbortSignal.timeout(20000),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || data.msg || response.status)
  return data
}
async function actor(email, pass = password) {
  const result = await post('/auth/v1/token?grant_type=password',{email,password:pass})
  return {token:result.access_token, call:(operation,payload={})=>post('/rest/v1/rpc/examroom_request',{operation,payload},result.access_token)}
}
const [admin,examiner,candidate,visitor] = await Promise.all([
  actor(process.env.EXAMROOM_TEST_ADMIN_EMAIL || 'phase3-admin@examroom.example'),
  actor('examiner@examroom.example'),actor('candidate@examroom.example'),actor('visitor@examroom.example'),
])
const demos = await Promise.all(['admin','examiner','candidate','visitor'].map(name=>actor('demo-'+name+'@uncooked.example','UnCooked-Demo-2026!')))
for (let i=0;i<demos.length;i++) {
  const dashboard = await demos[i].call('dashboard')
  assert.equal(dashboard.profile.role,['administrator','examiner','candidate','candidate'][i])
}
assert.equal((await demos[1].call('dashboard')).exams.filter(exam=>exam.title.includes('·')).length,4)
await assert.rejects(admin.call('admin_save',{name:'Missing password',email:'invalid-'+Date.now()+'@example.com',role:'candidate',active:true}),/password/i)
await assert.rejects(examiner.call('bank_save',{prompt:'Invalid choices',kind:'single',choices:[null,'B','C','D'],correct:0,correctSet:[],marks:1,topic:'Test',difficulty:'easy'}),/choices/)
await assert.rejects(candidate.call('admin_list'))
await assert.rejects(candidate.call('bank'))
await assert.rejects(candidate.call('dashboard',[]),/object/)
for (const name of ['examroom_v1','examroom_v2','examroom_v3']) {
  await assert.rejects(post('/rest/v1/rpc/'+name,{operation:'dashboard',payload:{}},candidate.token))
}
await assert.rejects(post('/rest/v1/rpc/examroom_request',{operation:'dashboard',payload:{}}))
const now=Date.parse((await examiner.call('dashboard')).serverTime)
const {id:examId}=await examiner.call('create',{
  title:'Final security and marking verification '+Date.now(),instructions:'QA',
  opensAt:new Date(now-1000),closesAt:new Date(now+120000),duration:2,
  questions:[{prompt:'Single mark test',choices:['A','B','C','D'],correct:0,marks:3}],
})
await examiner.call('bank_save',{prompt:'Partial marking '+examId,kind:'multiple',choices:['A','B','C','D'],correct:0,correctSet:[0,2],marks:2,topic:'QA',difficulty:'easy'})
const bank=await examiner.call('bank')
await examiner.call('assign',{examId,questionId:bank.find(q=>q.prompt==='Partial marking '+examId).id})
await examiner.call('enroll',{examId,email:'candidate@examroom.example'})
await examiner.call('publish',{examId})
for (const operation of ['manage','monitor','analytics','sandbox','report','publish_results']) {
  await assert.rejects(demos[1].call(operation,{examId,published:true}))
}
await assert.rejects(visitor.call('start',{examId}))
const [first,retry] = await Promise.all([candidate.call('start',{examId}),candidate.call('start',{examId})])
assert.equal(first.deadline,retry.deadline)
for (const question of first.questions) {
  assert.ok(!('correct' in question) && !('correct_set' in question))
  await candidate.call('save',{
    examId,questionId:question.id,choice:0,selected:question.kind==='multiple'?[0]:[],
    written:'Unexpected data should be ignored.',flagged:true,score:9999,deadline:'2099-01-01',
  })
}
const restored=await candidate.call('resume',{examId})
assert.equal(restored.questions.find(q=>q.kind==='single').written,'')
assert.equal(restored.questions.find(q=>q.kind==='multiple').choice,null)
assert.equal(restored.deadline,first.deadline)
await candidate.call('submit',{examId})
await assert.rejects(candidate.call('report',{examId}),/Published/)
await examiner.call('publish_results',{examId,published:true})
const score=(await candidate.call('result',{examId})).scores[0]
assert.equal(score.score,3)
assert.equal(score.total,5)
await assert.rejects(visitor.call('result',{examId}))
await assert.rejects(candidate.call('grade',{examId,attemptId:score.id,questionId:first.questions[0].id,grade:999}))
const issued=await candidate.call('report',{examId})
const verification=await post('/rest/v1/rpc/verify_report',{code:issued.token})
assert.equal(verification.valid,true)
assert.deepEqual(Object.keys(verification).sort(),['issuedAt','valid'])
console.log('PASS: all demonstration accounts, server validation, private legacy endpoints, anonymous access denial, examiner ownership, concurrent starts, answer-key privacy, partial multi-select marking, tamper rejection, and report privacy')
