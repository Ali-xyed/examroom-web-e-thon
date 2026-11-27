import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {createDatesheetHandler,composeDatesheet} from '../api/datesheet.js'

// Isolated PostgreSQL in WASM. No hosted database or website is contacted.
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create schema auth;create schema extensions;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;`)
for(const name of ['20261127000100_phase_one','20261127000200_phase_two','20261127000400_phase_three','20261127000500_final_validation','20261127000600_candidate_directory','20261127000700_integrity_fairness_disputes']) {
  try{await db.exec(await readFile('supabase/migrations/'+name+'.sql','utf8'))}
  catch(error){console.error('MIGRATION FAILED:',name,error.message,error.cause);throw error}
}
const ids={e:'10000000-0000-0000-0000-000000000001',other:'10000000-0000-0000-0000-000000000002',c:'20000000-0000-0000-0000-000000000001',c2:'20000000-0000-0000-0000-000000000002',visitor:'20000000-0000-0000-0000-000000000003'}
for(const [name,id] of Object.entries(ids)) {
 await db.query('insert into auth.users values($1,$2)',[id,name+'@local.test'])
 await db.query('insert into examroom.profiles(id,role,name) values($1,$2,$3)',[id,['e','other'].includes(name)?'examiner':'candidate',name])
}
async function call(who,operation,payload={}) {
 await db.query("select set_config('test.user',$1,false)",[ids[who]])
 return (await db.query('select public.examroom_request($1,$2::jsonb) result',[operation,JSON.stringify(payload)])).rows[0].result
}
const now=Date.now()
const created=await call('e','create',{title:'Local phase 5',opensAt:new Date(now-1000),closesAt:new Date(now+3600000),duration:30,questions:[...Array(6)].map((_,i)=>({prompt:'Question '+i,choices:['A','B','C','D'],correct:0,marks:i<3?1:2,difficulty:i<3?'easy':'hard'}))})
const examId=created.id
await call('e','paper_settings',{examId,buckets:[{difficulty:'easy',marks:1,count:2},{difficulty:'hard',marks:2,count:1}]})
await assert.rejects(call('e','paper_settings',{examId,buckets:[{difficulty:'easy',marks:1,count:9}]}),/Not enough/)
await call('e','enroll',{examId,email:'c@local.test'});await call('e','enroll',{examId,email:'c2@local.test'})
await call('e','publish',{examId})
const first=await call('c','start',{examId}),second=await call('c2','start',{examId})
for(const attempt of [first,second]) {
 assert.equal(attempt.questions.length,3)
 assert.equal(attempt.questions.filter(q=>q.difficulty==='easy').length,2)
 assert.equal(attempt.questions.filter(q=>q.difficulty==='hard').length,1)
 assert.equal(attempt.questions.reduce((sum,q)=>sum+q.marks,0),4)
 assert.ok(attempt.questions.every(q=>!('correct' in q)))
}
const resumed=await call('c','resume',{examId})
assert.equal(resumed.deadline,first.deadline);assert.deepEqual(resumed.questions.map(q=>q.id),first.questions.map(q=>q.id))
const unassigned=(await db.query('select id from examroom.questions where exam_id=$1 and id<>all($2::uuid[])',[examId,first.questions.map(q=>q.id)])).rows[0].id
await assert.rejects(call('c','save',{examId,questionId:unassigned,choice:0,revision:1}),/not assigned/)
const q=first.questions[0]
await call('c','save',{examId,questionId:q.id,choice:1,selected:[],written:'',flagged:false,revision:1,activeMs:1000})
await call('c','incident',{examId,event:'paste',clientId:'30000000-0000-0000-0000-000000000001',clientAt:new Date().toISOString()})
await call('c','incident',{examId,event:'paste',clientId:'30000000-0000-0000-0000-000000000001',clientAt:new Date().toISOString()})
assert.equal((await db.query('select count(*)::integer n from examroom.incidents')).rows[0].n,1)
assert.equal((await db.query('select count(*)::integer n from public.examroom_live_events')).rows[0].n,1)
await assert.rejects(call('visitor','incident',{examId,event:'paste',clientId:'30000000-0000-0000-0000-000000000002'}),/Attempt unavailable/)
await call('c','dispute_create',{examId,questionId:q.id,kind:'question',reason:'The wording is ambiguous and needs review.'})
await assert.rejects(call('c','dispute_create',{examId,questionId:q.id,kind:'question',reason:'Duplicate dispute should not be accepted.'}),/already pending/)
await call('c','submit',{examId});await call('c2','submit',{examId})
const before=await call('e','monitor',{examId});assert.equal(before.integrity[0].timings[0].indicator,true)
const dispute=(await call('e','disputes',{examId})).disputes[0]
await assert.rejects(call('other','dispute_resolve',{examId,disputeId:dispute.id,resolution:'ambiguous',reason:'This question is ambiguous.'}),/unavailable/)
await call('e','dispute_resolve',{examId,disputeId:dispute.id,resolution:'ambiguous',reason:'Both interpretations are reasonable; award full marks.'})
const after=await call('e','monitor',{examId})
assert.equal(Number(after.scores.find(s=>s.candidate_id===ids.c).score),q.marks)
assert.ok((await call('e','audit',{examId})).some(x=>x.action==='regrade.all_attempts'))
await assert.rejects(db.exec('update examroom.audit_log set action=\'tampered\''),/append-only/)
await assert.rejects(db.exec('delete from examroom.audit_log'),/append-only/)
await assert.rejects(db.exec('truncate examroom.audit_log'),/append-only/)
await assert.rejects(call('c','audit',{examId}),/unavailable/)
await call('e','publish_results',{examId,published:true})
await call('c','dispute_create',{examId,questionId:q.id,kind:'grade',reason:'I would like a review of the published grade.'})
const gradeDispute=(await call('e','disputes',{examId})).disputes.find(d=>d.kind==='grade')
await assert.rejects(call('e','dispute_resolve',{examId,disputeId:gradeDispute.id,resolution:'grade',grade:1000,reason:'Out of range grade should be rejected.'}),/within/)
await call('e','dispute_resolve',{examId,disputeId:gradeDispute.id,resolution:'reject',reason:'The full question marks have already been awarded.'})
const heartbeat=await call('c','heartbeat',{examId,connectionId:'40000000-0000-0000-0000-000000000001'})
assert.equal(heartbeat.deadline,first.deadline)
assert.equal((await call('e','datesheet',{examId})).candidates[0].deliverable,false)
await assert.rejects(call('c','mail_claim',{examId}),/unavailable/)

// SMTP is replaced by a fake transport. No email is sent.
let smtpCalls=0,completed=[]
const env={EMAIL_HOST:'smtp.invalid',EMAIL_PORT:'587',EMAIL_USER:'sender@local.test',EMAIL_PASS:'fake',SUPABASE_URL:'https://local.invalid',SUPABASE_PUBLISHABLE_KEY:'fake'}
const handler=createDatesheetHandler({env,transportFactory:options=>{assert.equal(options.requireTLS,true);return {sendMail:async message=>{smtpCalls++;assert.ok(message.html.includes('UnCooked'));assert.equal(message.attachments.length,1);return {accepted:['recipient@local.test']}}}},rpcOverride:async(op,payload)=>{if(op==='mail_claim')return {exam:{id:examId,title:'Local <exam>',opens_at:new Date(),closes_at:new Date(now+3600000),duration:30,instructions:'<script>bad</script>'},jobs:[{id:'mail',claimId:'claim',name:'Test',email:'recipient@local.test'}]};completed.push(payload);return {}}})
const res={setHeader(){},status(code){this.code=code;return this},json(value){this.value=value;return this}}
await handler({method:'POST',headers:{authorization:'Bearer fake'},body:{examId}},res)
assert.equal(res.code,200);assert.equal(smtpCalls,1);assert.equal(completed[0].sent,true)
await handler({method:'POST',headers:{},body:{examId}},res);assert.equal(res.code,401)
const mail=composeDatesheet({id:examId,title:'<script>',opens_at:new Date(),closes_at:new Date(now+3600000),duration:30,instructions:'x'},{name:'<b>hi</b>'},'https://local.test')
assert.ok(!mail.html.includes('<script>'));assert.ok(mail.attachments[0].content.includes('BEGIN:VCALENDAR'))
console.log('PASS local PostgreSQL: migrations, fixed balanced papers, stable deadlines, unassigned-question rejection, incident deduplication, live event creation, dispute ownership, duplicate rejection, automatic regrade, immutable audit, grade validation, email authorization; fake SMTP delivery and escaped themed emails.')
// Exercise expired reconnects and the server-generated disconnect log.
const expires=(await call('e','create',{title:'Expiry test',opensAt:new Date(now-1000),closesAt:new Date(now+3600000),duration:30,questions:[{prompt:'Expiry question',choices:['A','B','C','D'],correct:0,marks:1}]})).id
await call('e','enroll',{examId:expires,email:'c@local.test'});await call('e','publish',{examId:expires})
const expiryPaper=await call('c','start',{examId:expires})
await db.query("update examroom.attempts set started_at=clock_timestamp()-interval '5 minutes',deadline=clock_timestamp()-interval '1 minute',last_seen=clock_timestamp()-interval '3 minutes' where exam_id=$1",[expires])
const expiryHeartbeat=await call('c','heartbeat',{examId:expires,connectionId:'40000000-0000-0000-0000-000000000001'})
assert.ok(expiryHeartbeat.submittedAt);assert.ok(Date.parse(expiryHeartbeat.deadline)<Date.now())
await call('c','save',{examId:expires,questionId:expiryPaper.questions[0].id,choice:0,revision:99})
assert.equal((await db.query('select count(*)::integer n from examroom.answers an join examroom.attempts at on at.id=an.attempt_id where at.exam_id=$1',[expires])).rows[0].n,0)
assert.ok((await db.query('select count(*)::integer n from examroom.disconnects')).rows[0].n>0)
await db.query("select set_config('test.user',$1,false)",[ids.other]);await db.exec('set role authenticated')
assert.equal((await db.query('select * from public.examroom_live_events')).rows.length,0)
await db.exec('reset role');await db.query("select set_config('test.user',$1,false)",[ids.e]);await db.exec('set role authenticated')
assert.ok((await db.query('select * from public.examroom_live_events')).rows.length>0)
await db.exec('reset role')
console.log('PASS local: late saves rejected, expired reconnect finalized without extra time, heartbeat disconnect log, realtime row ownership policies')
if(process.argv.includes('--serve')) {
 const {createServer}=await import('node:http'),{WebSocketServer}=await import('ws')
 const uiExam=(await call('e','create',{title:'Local UI assessment',opensAt:new Date(now-1000),closesAt:new Date(now+3600000),duration:30,questions:[{prompt:'Local UI question',choices:['A','B','C','D'],correct:0,marks:1,difficulty:'easy'},{prompt:'Local UI hard question',choices:['A','B','C','D'],correct:0,marks:2,difficulty:'hard'}]})).id
 await call('e','enroll',{examId:uiExam,email:'c@local.test'});await call('e','publish',{examId:uiExam})
 const tokenFor=id=>Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.local'
 const actorFor=token=>{try{const id=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;return Object.keys(ids).find(k=>ids[k]===id)}catch{return null}}
 let chain=Promise.resolve()
 const wire=message=>JSON.stringify([message.join_ref||null,message.ref||null,message.topic,message.event,message.payload])
 const sockets=new Set(),delivered=new Set((await db.query('select id from public.examroom_live_events')).rows.map(r=>r.id))
 const serial=(work)=>{const result=chain.then(work);chain=result.catch(()=>{});return result}
 async function publishEvents(){
   const rows=(await db.query('select * from public.examroom_live_events')).rows
   for(const row of rows){if(delivered.has(row.id))continue;delivered.add(row.id);for(const sock of sockets)if(sock.readyState===1&&ids[sock.actor]===row.owner_id&&sock.topic)sock.send(wire({topic:sock.topic,event:'postgres_changes',payload:{ids:[1],data:{schema:'public',table:'examroom_live_events',commit_timestamp:new Date().toISOString(),type:'INSERT',columns:Object.keys(row).map(name=>({name,type:'text'})),record:row,old_record:{},errors:null}},ref:null}))}
 }
 const server=createServer(async(req,res)=>{
   const path=new URL(req.url,'http://localhost').pathname
   const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
   try{
     if(req.method==='POST'){
       let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body)
       if(path==='/auth/v1/token'){
         const name=data.email.split('@')[0],id=ids[name];if(!id)return json(400,{message:'Incorrect login.'})
         return json(200,{access_token:tokenFor(id),refresh_token:tokenFor(id),expires_in:3600,user:{id}})
       }
       const actor=actorFor((req.headers.authorization||'').replace('Bearer ',''));if(!actor)return json(401,{message:'Sign in.'})
       if(path==='/rest/v1/rpc/examroom_request')return await serial(async()=>{try{const result=await call(actor,data.operation,data.payload);await publishEvents();json(200,result)}catch(error){json(400,{message:error.message})}})
       return json(404,{message:'Local route unavailable.'})
     }
     if(path==='/config.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end('export default '+JSON.stringify({url:'http://127.0.0.1:4197',key:'sb_publishable_local_fixture'})+';')}
     const asset=path==='/'||path==='/login'?'/index.html':path
     if(asset.includes('..'))return json(404,{})
     const bytes=await readFile('dist'+asset)
     res.writeHead(200,{'Content-Type':asset.endsWith('.js')?'text/javascript':asset.endsWith('.css')?'text/css':asset.endsWith('.html')?'text/html':'application/octet-stream','Cache-Control':'no-store'});res.end(bytes)
   }catch{json(404,{message:'Local resource unavailable.'})}
 })
 const ws=new WebSocketServer({server})
 ws.on('connection',sock=>{sockets.add(sock);sock.on('close',()=>sockets.delete(sock));sock.on('message',raw=>{
   const parsed=JSON.parse(raw),msg=Array.isArray(parsed)?{join_ref:parsed[0],ref:parsed[1],topic:parsed[2],event:parsed[3],payload:parsed[4]}:parsed
   if(msg.event==='phx_join'){sock.topic=msg.topic;sock.actor=actorFor(msg.payload.access_token);sock.send(wire({topic:msg.topic,event:'phx_reply',ref:msg.ref,join_ref:msg.join_ref,payload:{status:'ok',response:{postgres_changes:msg.payload.config.postgres_changes.map(binding=>({id:1,...binding}))}}}))}
   else if(msg.event==='heartbeat'||msg.event==='phx_leave')sock.send(wire({topic:msg.topic,event:'phx_reply',ref:msg.ref,payload:{status:'ok',response:{}}}))
 })})
 server.listen(4197,'127.0.0.1',()=>console.log('LOCAL_FIXTURE_READY '+uiExam))
} else await db.close()
