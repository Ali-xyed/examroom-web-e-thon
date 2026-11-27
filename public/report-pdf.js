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
    fetch('/fonts/DejaVuSans.ttf').then(async response => {
      if (!response.ok) throw new Error('The report font could not load. Please try again.')
      const bytes = new Uint8Array(await response.arrayBuffer())
      return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    }),
  ]).catch(error => { dependencies = null; throw error })
  return dependencies
}

export function createReportPdf(jsPDF, font, report) {
  const doc = new jsPDF({unit:'mm', format:'a4', compress:true})
  doc.addFileToVFS('DejaVuSans.ttf', font)
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal')
  doc.setFont('DejaVu')
  doc.setProperties({title: 'UnCooked examination report', author: 'UnCooked'})
  const margin = 20
  let y = 26
  const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  function text(value, size = 11, color = '#37352f') {
    doc.setFontSize(size)
    doc.setTextColor(color)
    const lines = doc.splitTextToSize(clean(value), 170)
    for (const line of lines) {
      if (y > 270) { doc.addPage(); y = 25 }
      doc.text(line, margin, y)
      y += size * .5 + 2
    }
    y += 3
  }
  text('UnCooked', 24)
  text(report.examiner ? 'Examination performance summary' : 'Candidate result report', 13, '#787774')
  doc.setDrawColor('#e9e9e7')
  doc.line(margin, y, 190, y)
  y += 12
  text(report.title, 17)
  text('Issued ' + new Date(report.issuedAt || Date.now()).toLocaleString(), 10, '#787774')
  if (report.examiner) {
    text(report.scores.length + ' submitted attempts', 12)
    for (const score of report.scores) {
      if (y + 34 > 270) { doc.addPage(); y = 25 }
      text(score.name, 12)
      text('Score ' + score.score + ' / ' + score.total + ' · Written grades pending ' + score.pending, 10)
    }
  } else {
    text(report.name, 15)
    text('Score ' + report.score + ' / ' + report.total, 21)
    y += 8
    text('Report verification', 13)
    text('Code ' + report.token, 10)
    const base = globalThis.location?.origin || 'https://examroom-web-e-thon.vercel.app'
    const url = base + '/?verify=' + encodeURIComponent(report.token)
    const linkTop = y - 4
    text(url, 9, '#336548')
    doc.link(margin, linkTop, 170, y - linkTop, {url})
    text('Use this code to check authenticity and the current validity of the issued result.', 10, '#787774')
  }
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFontSize(9)
    doc.setTextColor('#787774')
    doc.text('UnCooked · ' + page + ' / ' + pages, margin, 285)
  }
  return doc
}

export async function downloadReport(report) {
  const [jsPDF, font] = await loadDependencies()
  createReportPdf(jsPDF, font, report).save('UnCooked-report.pdf')
}
