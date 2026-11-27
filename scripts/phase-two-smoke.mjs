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
  const session=await post('/auth/v1/token?grant_type=password',{email:name==='admin'?(process.env.EXAMROOM_TEST_ADMIN_EMAIL||'phase3-admin@examroom.example'):name+'@examroom.example',password})
  return (operation,payload={})=>post('/rest/v1/rpc/examroom_request',{operation,payload},session.access_token)
}
const [admin,examiner,candidate,visitor]=await Promise.all(['admin','examiner','candidate','visitor'].map(actor))
const stamp=Date.now()
const user=await admin('admin_save',{name:'Phase 2 temporary candidate',email:'phase2-'+stamp+'@examroom.example',password,role:'candidate',active:true})
const created=user.find(u=>u.email==='phase2-'+stamp+'@examroom.example')
assert.ok(created)
await admin('admin_save',{...created,active:false})
await assert.rejects(candidate('admin_list'))
await assert.rejects(visitor('bank'))
const base={prompt:'Phase 2 '+stamp,choices:['A','B','C','D'],correct:0,correctSet:[0,2],marks:2,topic:'Verification',difficulty:'medium'}
await examiner('bank_save',{...base,kind:'multiple'})
let bank=await examiner('bank')
const multi=bank.find(q=>q.prompt===base.prompt)
await examiner('bank_save',{...base,prompt:'Written '+stamp,kind:'written',marks:5})
bank=await examiner('bank')
const written=bank.find(q=>q.prompt==='Written '+stamp)
const now=Date.parse((await examiner('dashboard')).serverTime)
const {id:examId}=await examiner('create',{title:'Phase 2 verification '+stamp,instructions:'Mixed exam',duration:10,opensAt:new Date(now-60000),closesAt:new Date(now+3600000),questions:[{prompt:'Single',choices:base.choices,correct:0,marks:1}]})
for(const question of [multi,written]) await examiner('assign',{examId,questionId:question.id})
await examiner('settings',{examId,randomize:true})
await examiner('enroll',{examId,email:'candidate@examroom.example'})
await examiner('publish',{examId})
await assert.rejects(examiner('assign',{examId,questionId:multi.id}),/locked/)
await examiner('bank_save',{...base,id:multi.id,prompt:'Changed bank question',kind:'multiple'})
let attempt=await candidate('start',{examId})
assert.equal(attempt.questions.length,3)
assert.ok(attempt.questions.some(q=>q.prompt===base.prompt))
assert.deepEqual((await candidate('resume',{examId})).questions.map(q=>q.id),attempt.questions.map(q=>q.id))
await assert.rejects(visitor('monitor',{examId}))
await examiner('announce',{examId,message:'Five minutes remain.'})
assert.equal((await candidate('announcements',{examId}))[0].message,'Five minutes remain.')
for(const q of attempt.questions) {
  assert.ok(!('correct_set' in q))
  await candidate('save',{examId,questionId:q.id,choice:q.kind==='single'?0:null,selected:q.kind==='multiple'?[0,2]:[],written:q.kind==='written'?'A written response.':''})
}
await candidate('incident',{examId,event:'page_hidden'})
await candidate('submit',{examId})
const monitor=await examiner('monitor',{examId})
const at=monitor.attempts[0]
assert.equal(monitor.scores[0].score,3)
assert.equal(Number(monitor.scores[0].pending),1)
assert.equal(at.incidents.length,1)
assert.equal((await candidate('result',{examId})).published,false)
await assert.rejects(examiner('publish_results',{examId,published:true}),/grade/)
const q=at.written[0]
await assert.rejects(examiner('grade',{examId,attemptId:at.id,questionId:q.id,grade:6}),/maximum/)
await examiner('grade',{examId,attemptId:at.id,questionId:q.id,grade:4})
await examiner('publish_results',{examId,published:true})
const result=await candidate('result',{examId})
assert.equal(result.scores[0].score,7)
assert.equal(result.scores[0].total,8)
await assert.rejects(visitor('result',{examId}))
await assert.rejects(examiner('grade',{examId,attemptId:at.id,questionId:q.id,grade:3}),/Unpublish/)
console.log('PASS: Phase 2 account management, question bank isolation, stable randomization, mixed answers, announcements, incidents, grading and private published results')
