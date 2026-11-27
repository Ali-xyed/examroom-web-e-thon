const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY
const qaPassword = process.env.EXAMROOM_DEMO_PASSWORD
const demoPassword = 'UnCooked-Demo-2026!'
const accounts = [
  ['demo-admin', 'Demo Administrator', 'administrator'],
  ['demo-examiner', 'Demo Examiner', 'examiner'],
  ['demo-candidate', 'Demo Candidate', 'candidate'],
  ['demo-visitor', 'Demo Visitor', 'candidate'],
]
async function post(path, body, token) {
  const response = await fetch(url + path, {
    method:'POST', headers:{apikey:key,'Content-Type':'application/json',...(token ? {Authorization:'Bearer '+token} : {})},
    body:JSON.stringify(body), signal:AbortSignal.timeout(20000),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || result.msg || 'Demo setup request failed.')
  return result
}
async function actor(email, password) {
  const session = await post('/auth/v1/token?grant_type=password',{email,password})
  return (operation,payload={})=>post('/rest/v1/rpc/examroom_request',{operation,payload},session.access_token)
}
const admin = await actor(process.env.EXAMROOM_TEST_ADMIN_EMAIL || 'phase3-admin@examroom.example', qaPassword)
const users = await admin('admin_list')
for (const [prefix,name,role] of accounts) {
  const email = prefix+'@uncooked.example'
  if (!users.some(user=>user.email===email)) await admin('admin_save',{email,name,role,password:demoPassword,active:true})
}
const examiner = await actor('demo-examiner@uncooked.example',demoPassword)
const candidate = await actor('demo-candidate@uncooked.example',demoPassword)
const bankQuestions = [
  {prompt:'Select the semantic HTML elements.',kind:'multiple',choices:['main','aside','font','center'],correct:0,correctSet:[0,1],marks:2,topic:'Web fundamentals',difficulty:'medium'},
  {prompt:'Explain why the examination deadline should be enforced by the server.',kind:'written',choices:['Unused A','Unused B','Unused C','Unused D'],correct:0,correctSet:[],marks:4,topic:'Web fundamentals',difficulty:'medium'},
]
for (const question of bankQuestions) {
  if (!(await examiner('bank')).some(item=>item.prompt===question.prompt)) await examiner('bank_save',question)
}
const bank=await examiner('bank')
const snapshot=await examiner('dashboard')
const now=Date.parse(snapshot.serverTime)
for (const [title,state] of [
  ['Mixed assessment · draft preview','draft'],
  ['Web fundamentals · take an exam','live'],
  ['Written assessment · awaiting grading','grading'],
  ['Web fundamentals · published result','published'],
]) {
  if (snapshot.exams.some(exam=>exam.title===title)) continue
  const {id:examId}=await examiner('create',{
    title,instructions:'Read each question carefully. Select all correct choices for multiple-select questions. Use the scratchpad for rough work.',
    opensAt:new Date(now-60000),closesAt:new Date(now+72*3600000),duration:10,
    questions:[{prompt:'Which HTTP method retrieves a resource?',choices:['GET','POST','PATCH','DELETE'],correct:0,marks:1}],
  })
  for (const question of bankQuestions) await examiner('assign',{examId,questionId:bank.find(item=>item.prompt===question.prompt).id})
  await examiner('settings',{examId,randomize:true})
  await examiner('enroll',{examId,email:'demo-candidate@uncooked.example'})
  if (state==='draft') continue
  await examiner('publish',{examId})
  if (state==='live') continue
  const attempt=await candidate('start',{examId})
  for (const question of attempt.questions) await candidate('save',{
    examId,questionId:question.id,choice:question.kind==='single'?0:null,
    selected:question.kind==='multiple'?[0,1]:[],
    written:question.kind==='written'?'The server uses the original deadline for every save and submission, so changing a device clock or refreshing cannot extend the attempt.':'',
  })
  await candidate('submit',{examId})
  if (state==='published') {
    const monitor=await examiner('monitor',{examId})
    const submitted=monitor.attempts[0]
    for (const question of submitted.written) await examiner('grade',{examId,attemptId:submitted.id,questionId:question.id,grade:3})
    await examiner('publish_results',{examId,published:true})
  }
}
console.log('Demo accounts and four demonstration exam states are ready.')
