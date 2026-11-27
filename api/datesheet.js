import nodemailer from 'nodemailer'

export const config={maxDuration:120}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const icsEscape=value=>String(value??'').replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\r','')
const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')
export function composeDatesheet(exam,recipient,appUrl) {
  const login=appUrl.replace(/\/$/,'')+'/login'
  const format=value=>new Intl.DateTimeFormat('en-PK',{dateStyle:'full',timeStyle:'short',timeZone:'Asia/Karachi'}).format(new Date(value))+' (Pakistan time)'
  const text=`Hello ${recipient.name},\n\nYour examination datesheet\n${exam.title}\nOpens: ${format(exam.opens_at)}\nCloses: ${format(exam.closes_at)}\nDuration: ${exam.duration} minutes\n\n${exam.instructions}\n\nSign in: ${login}\nYour attempt ends at the earlier of your allotted duration or the closing time. Reconnecting does not add time.\n\nUnCooked`
  const html=`<!doctype html><html><body style="margin:0;background:#f6f6f3;font-family:Arial,sans-serif;color:#34352e"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" style="max-width:100%;background:#fff;border:1px solid #e4e4df;border-radius:14px"><tr><td style="padding:32px"><p style="font-size:22px;font-weight:bold;margin:0">.UC &nbsp; UnCooked</p><p style="color:#73756c;font-size:12px;letter-spacing:2px">EXAMINATION DATESHEET</p><h1 style="font-size:26px">${escape(exam.title)}</h1><p>Hello ${escape(recipient.name)},</p><p>You are enrolled in the following examination.</p><table role="presentation" width="100%" style="line-height:1.8;background:#f6f6f3;padding:16px"><tr><td><strong>Opens</strong></td><td>${escape(format(exam.opens_at))}</td></tr><tr><td><strong>Closes</strong></td><td>${escape(format(exam.closes_at))}</td></tr><tr><td><strong>Duration</strong></td><td>${exam.duration} minutes</td></tr></table><p style="white-space:pre-wrap">${escape(exam.instructions)}</p><p style="padding:20px 0"><a href="${escape(login)}" style="background:#34352e;color:white;text-decoration:none;padding:13px 22px;border-radius:7px">Open UnCooked</a></p><p style="font-size:13px;color:#73756c">Your attempt ends at the earlier of your allotted duration or the closing time. Reconnecting does not add time.</p><hr style="border:0;border-top:1px solid #e4e4df"><p style="font-size:12px;color:#73756c">Keep the attached calendar file for your schedule. This message contains no password or private login token.</p></td></tr></table></td></tr></table></body></html>`
  const calendar=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//UnCooked//Examination Datesheet//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${exam.id}@uncooked`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(exam.opens_at)}`,`DTEND:${stamp(exam.closes_at)}`,`SUMMARY:${icsEscape(exam.title)}`,`DESCRIPTION:${icsEscape('Duration: '+exam.duration+' minutes. '+exam.instructions+' Sign in: '+login)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n')+'\r\n'
  return {subject:'Examination datesheet · '+exam.title,text,html,attachments:[{filename:'uncooked-datesheet.ics',content:calendar,contentType:'text/calendar; charset=utf-8'}]}
}

export function createDatesheetHandler({env=process.env,transportFactory=nodemailer.createTransport,rpcOverride}={}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store')
    if(req.method!=='POST')return res.status(405).json({error:'Use POST.'})
    const token=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1]
    if(!token)return res.status(401).json({error:'Sign in to send datesheets.'})
    const examId=req.body?.examId
    if(typeof examId!=='string'||! /^[a-f0-9-]{36}$/i.test(examId))return res.status(400).json({error:'Provide a valid examination ID.'})
    if(!env.EMAIL_HOST||!env.EMAIL_USER||!env.EMAIL_PASS||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return res.status(503).json({error:'Email delivery has not been configured by the administrator.'})
    const rpc=rpcOverride||(async(operation,payload)=>{
      const response=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/examroom_request',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({operation,payload}),signal:AbortSignal.timeout(20000)})
      const data=await response.json()
      if(!response.ok)throw Object.assign(new Error(data.message||'Examination access denied.'),{status:response.status})
      return data
    })
    try {
      // Database authorization and recipient selection happen before SMTP is contacted.
      const batch=await rpc('mail_claim',{examId})
      const port=Number(env.EMAIL_PORT||587)
      const transport=transportFactory({host:env.EMAIL_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:env.EMAIL_USER,pass:env.EMAIL_PASS},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000})
      let sent=0,failed=0
      try {
        for(const job of batch.jobs) {
          let delivered=false
          try {
            const result=await transport.sendMail({from:{name:'UnCooked',address:env.EMAIL_USER},to:{name:job.name,address:job.email},...composeDatesheet(batch.exam,job,env.APP_URL||'https://examroom-web-e-thon.vercel.app')})
            delivered=result.accepted?.length>0
            await rpc('mail_complete',{examId,mailId:job.id,claimId:job.claimId,sent:delivered,error:delivered?null:'SMTP recipient was not accepted.'})
            if(delivered)sent++;else failed++
          } catch {
            // An accepted SMTP message must never be marked failed and blindly resent.
            if(delivered)sent++
            else {failed++;await rpc('mail_complete',{examId,mailId:job.id,claimId:job.claimId,sent:false,error:'Delivery failed. Check the server mail configuration and retry.'}).catch(()=>{})}
          }
        }
      } finally {transport.close?.()}
      return res.status(200).json({processed:batch.jobs.length,sent,failed})
    } catch(error) {
      return res.status(error.status===401?401:403).json({error:error.status===401?'Sign in again.':'The datesheet could not be prepared. Check examination ownership and publication.'})
    }
  }
}
export default createDatesheetHandler()
