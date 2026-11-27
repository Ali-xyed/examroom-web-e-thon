let dependencies

async function loadDependencies() {
  dependencies ??= Promise.all([
    new Promise((resolve, reject) => {
      if (globalThis.jspdf) return resolve(globalThis.jspdf.jsPDF)
      const script = document.createElement('script')
      script.src = '/vendor/jspdf.umd.min.js'
      script.onload = () => resolve(globalThis.jspdf.jsPDF)
      script.onerror = () => { script.remove(); reject(new Error('The PDF renderer could not load. Check your connection and try again.')) }
      document.head.append(script)
    }),
    ...['/fonts/DejaVuSans.ttf','/fonts/DejaVuSans-Bold.ttf','/reference/uc-logo.png'].map(url => fetch(url).then(async response => {
      if (!response.ok) throw new Error('The report font could not load. Please try again.')
      const bytes = new Uint8Array(await response.arrayBuffer())
      return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    })),
  ]).catch(error => { dependencies = null; throw error })
  return dependencies
}

export function createReportPdf(jsPDF, font, report, assets = {}) {
  const doc = new jsPDF({unit:'mm', format:'a4', compress:true})
  doc.addFileToVFS('DejaVuSans.ttf', font)
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal')
  doc.addFileToVFS('DejaVuSans-Bold.ttf', assets.bold || font)
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold')
  doc.setProperties({title: report.title + ' | UnCooked report', author:'UnCooked'})
  const ink = '#37352f', muted = '#787774', line = '#e9e9e7', surface = '#f7f7f5'
  const issued = new Date(report.issuedAt || Date.now()).toLocaleString()
  let y = 0
  const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  function style(size = 10, bold = false, color = ink) {
    doc.setFont('DejaVu',bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color)
  }
  function text(value,x,top,size=10,bold=false,color=ink,options={}) {
    style(size,bold,color);doc.text(clean(value),x,top,options)
  }
  function box(x,top,w,h,fill=surface) {
    doc.setFillColor(fill);doc.setDrawColor(line);doc.roundedRect(x,top,w,h,2,2,'FD')
  }
  function header() {
    if(assets.logo) doc.addImage('data:image/png;base64,'+assets.logo,'PNG',16,12,22,11)
    text('UnCooked',assets.logo ? 40 : 18,20,15,true)
    text('EXAMINATION REPORT',192,18,8,false,muted,{align:'right'})
    text('Issued '+issued,192,24,8,false,muted,{align:'right'})
    doc.setDrawColor(line);doc.line(18,31,192,31)
    y=43
  }
  function ensure(height) { if(y+height>269) {doc.addPage();header()} }
  function wrapped(value,size=12,bold=false,width=174) {
    style(size,bold);return doc.splitTextToSize(clean(value),width)
  }
  function paragraph(value,size=10,bold=false,color=ink,width=174) {
    for(const row of wrapped(value,size,bold,width)) {
      ensure(7);text(row,18,y,size,bold,color);y+=size*.4+2.5
    }
  }
  header()
  text(report.examiner ? 'PERFORMANCE SUMMARY' : 'CANDIDATE RESULT',18,y,9,true,muted);y+=10
  paragraph(report.title,19,true);y+=8
  if(report.examiner) {
    const scores=report.scores
    const graded=scores.filter(score=>Number(score.pending)===0)
    const average=graded.length ? (graded.reduce((sum,score)=>sum+Number(score.score),0)/graded.length).toFixed(2) : '—'
    const pending=scores.filter(score=>Number(score.pending)>0).length
    for(const [index,label,value] of [[0,'SUBMITTED ATTEMPTS',scores.length],[1,'AVERAGE GRADED SCORE',average],[2,'AWAITING GRADING',pending]]) {
      const x=18+index*59;box(x,y,56,28);text(label,x+5,y+8,6.7,true,muted);text(value,x+5,y+21,18,true)
    }
    y+=40
    text('Candidate performance',18,y,12,true);y+=8
    function tableHead() {
      doc.setFillColor(ink);doc.rect(18,y,174,10,'F')
      text('CANDIDATE',22,y+6.5,8,true,'#ffffff')
      text('SCORE',126,y+6.5,8,true,'#ffffff')
      text('PERCENT',151,y+6.5,8,true,'#ffffff')
      text('GRADING',174,y+6.5,8,true,'#ffffff');y+=10
    }
    tableHead()
    if(!scores.length) {y+=9;paragraph('No submitted attempts are available.',10,false,muted)}
    scores.forEach((score,index)=>{
      const nameLines=wrapped(score.name,9,false,96)
      const height=Math.max(14,nameLines.length*5+7)
      if(y+height>268) {doc.addPage();header();tableHead()}
      doc.setFillColor(index%2 ? '#ffffff':surface);doc.rect(18,y,174,height,'F')
      nameLines.forEach((name,i)=>text(name,22,y+7+i*5,9))
      text(score.score+' / '+score.total,126,y+7,9,true)
      text(Number(score.total)>0 ? (Number(score.score)/Number(score.total)*100).toFixed(1)+'%' : '—',151,y+7,9)
      text(Number(score.pending)>0?'Pending':'Complete',174,y+7,7.5,false,muted)
      y+=height
    })
    y+=9;paragraph('Average includes fully graded submissions. Pending written grades may change the displayed totals.',8,false,muted)
  } else {
    const nameLines=wrapped(report.name,14,true,118)
    const cardHeight=Math.max(49,28+nameLines.length*7)
    ensure(cardHeight+12);box(18,y,174,cardHeight)
    text('CANDIDATE',24,y+10,8,true,muted)
    nameLines.forEach((name,i)=>text(name,24,y+22+i*7,14,true))
    text('FINAL SCORE',184,y+10,8,true,muted,{align:'right'})
    text(report.score+' / '+report.total,184,y+25,21,true,ink,{align:'right'})
    const percent=Number(report.total)>0 ? Number(report.score)/Number(report.total)*100 : 0
    text(percent.toFixed(1)+'%',184,y+35,10,false,muted,{align:'right'})
    y+=cardHeight+14
    text('Result details',18,y,12,true);y+=11
    for(const [label,value] of [['Publication status','Published'],['Marks awarded',report.score],['Maximum marks',report.total]]) {
      text(label,18,y,10,false,muted);text(value,192,y,10,true,ink,{align:'right'});doc.setDrawColor(line);doc.line(18,y+4,192,y+4);y+=13
    }
    y+=8;ensure(68);box(18,y,174,62)
    text('Report verification',24,y+11,12,true)
    text('Check the authenticity and current validity of this issued result.',24,y+20,9,false,muted)
    text('VERIFICATION CODE',24,y+31,7,true,muted)
    text(report.token,24,y+39,9)
    const base=globalThis.location?.origin || 'https://examroom-web-e-thon.vercel.app'
    const url=base+'/?verify='+encodeURIComponent(report.token)
    doc.setFillColor(ink);doc.roundedRect(24,y+46,49,10,2,2,'F')
    text('Verify this report',48.5,y+52.7,8.5,true,'#ffffff',{align:'center'})
    doc.link(24,y+46,49,10,{url})
    text('Verification confirms validity without disclosing private scores.',78,y+52.5,6.6,false,muted)
    y+=62
  }
  const pages=doc.getNumberOfPages()
  for(let page=1;page<=pages;page++) {
    doc.setPage(page);doc.setDrawColor(line);doc.line(18,278,192,278)
    text('UnCooked · Secure Examination Management System',18,285,8,false,muted)
    text('Page '+page+' of '+pages,192,285,8,false,muted,{align:'right'})
  }
  return doc
}

export async function downloadReport(report) {
  const [jsPDF,font,bold,logo] = await loadDependencies()
  createReportPdf(jsPDF,font,report,{bold,logo}).save(report.examiner ? 'UnCooked-performance-summary.pdf' : 'UnCooked-result-report.pdf')
}
