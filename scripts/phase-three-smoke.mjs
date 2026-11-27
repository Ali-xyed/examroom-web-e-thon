import assert from 'node:assert/strict'
const url=process.env.SUPABASE_URL
const key=process.env.SUPABASE_PUBLISHABLE_KEY
const password=process.env.EXAMROOM_DEMO_PASSWORD
async function post(path,body,token) {
  const response=await fetch(url+path,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)})
  const data=await response.json()
  if(!response.ok) throw new Error(data.message||data.msg)
  return data
}
async function actor(name) {
  const session=await post('/auth/v1/token?grant_type=password',{email:name+'@examroom.example',password})
  return (operation,payload={})=>post('/rest/v1/rpc/examroom_request',{operation,payload},session.access_token)
}
const [admin,examiner,candidate,visitor]=await Promise.all(['phase3-admin','examiner','candidate','visitor'].map(actor))

const stamp=Date.now()
const rows=[{prompt:'Imported '+stamp,kind:'single',choices:['A','B','C','D'],correct:1,correctSet:[],marks:2,topic:'Phase3',difficulty:'easy'}]
await assert.rejects(examiner('bulk_import',{rows:[...rows,{kind:'invalid'}]}),/Row 2/)
assert.ok(!(await examiner('bank')).some(q=>q.prompt===rows[0].prompt))
assert.equal((await examiner('bulk_import',{rows})).imported,1)
await assert.rejects(admin('bulk_import',{rows:[{name:'Missing password',email:'test@example.com'}]}),/Row 1/)
await assert.rejects(candidate('bulk_import',{rows}))
const now=Date.parse((await examiner('dashboard')).serverTime)
const {id:examId}=await examiner('create',{title:'Phase3 verification '+stamp,instructions:'Test',opensAt:new Date(now-1000),closesAt:new Date(now+3600000),duration:20,questions:[{prompt:'Question',choices:['A','B','C','D'],correct:1,marks:2}]})
const before=await examiner('monitor',{examId})
const sandbox=await examiner('sandbox',{examId})
assert.equal(sandbox.sandbox,true)
assert.equal((await examiner('monitor',{examId})).attempts.length,before.attempts.length)
await assert.rejects(candidate('sandbox',{examId}))
await examiner('enroll',{examId,email:'candidate@examroom.example'})
await examiner('publish',{examId})
const attempt=await candidate('start',{examId})
const questionId=attempt.questions[0].id
await candidate('save',{examId,questionId,choice:1,revision:2})
const stale=await candidate('save',{examId,questionId,choice:0,revision:1})
assert.equal(stale.stale,true)
assert.equal((await candidate('resume',{examId})).questions[0].choice,1)
await candidate('submit',{examId})
await examiner('publish_results',{examId,published:true})
const report=await candidate('report',{examId})
assert.equal(report.score,2)
const verify=code=>post('/rest/v1/rpc/verify_report',{code})
assert.equal((await verify(report.token)).valid,true)
assert.equal((await verify('00000000-0000-0000-0000-000000000000')).valid,false)
await assert.rejects(visitor('report',{examId}))
const analytics=await examiner('analytics',{examId})
assert.equal(Number(analytics[0].attempts),1)
assert.equal(Number(analytics[0].skipped),0)
assert.equal(Number(analytics[0].incorrect),0)
await examiner('publish_results',{examId,published:false})
assert.equal((await verify(report.token)).valid,false)
console.log('PASS: atomic import validation, sandbox isolation, stale-save protection, report authenticity and privacy, question analytics')
