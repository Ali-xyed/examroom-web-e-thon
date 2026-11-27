import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { examRequest } from '../api.js'
import { PageHeader, Panel, Button, FormError, Breadcrumb } from '../components/ui.jsx'

function recordErrors(record, administrator) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['Expected a JSON object.']
  const errors = []
  const text = value => typeof value === 'string' ? value.trim() : ''
  if (administrator) {
    if (text(record.name).length < 1 || text(record.name).length > 100) errors.push('Name must contain 1–100 characters.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text(record.email))) errors.push('Enter a valid email.')
    if (typeof record.password !== 'string' || record.password.length < 12) errors.push('Password must contain at least 12 characters.')
    return errors
  }
  if (!text(record.prompt) || text(record.prompt).length > 2000) errors.push('Question must contain 1–2,000 characters.')
  if (!['single', 'multiple', 'written'].includes(record.kind)) errors.push('Kind must be single, multiple, or written.')
  if (!Array.isArray(record.choices) || record.choices.length !== 4 || record.choices.some(c => !text(c) || text(c).length > 500)) errors.push('Provide four choices.')
  if (!Number.isInteger(record.correct) || record.correct < 0 || record.correct > 3) errors.push('Correct choice must be 0–3.')
  if (!Number.isInteger(record.marks) || record.marks < 1 || record.marks > 100) errors.push('Marks must be 1–100.')
  if (!['easy', 'medium', 'hard'].includes(record.difficulty)) errors.push('Difficulty must be easy, medium, or hard.')
  if (typeof record.topic !== 'string') errors.push('Provide a topic.')
  if (record.kind === 'multiple' && (!Array.isArray(record.correctSet) || !record.correctSet.length)) errors.push('Provide correctSet indexes.')
  return errors
}

function validateAll(rows, administrator) {
  const errors = rows.map(row => recordErrors(row, administrator))
  if (administrator) {
    const emails = new Set()
    rows.forEach((row, index) => {
      const email = typeof row?.email === 'string' ? row.email.trim().toLowerCase() : ''
      if (email && emails.has(email)) errors[index].push('This email is duplicated in the file.')
      emails.add(email)
    })
  }
  return errors
}

export default function ImportView({ notify, profile }) {
  const administrator = profile.role === 'administrator'
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState({ message: '', kind: '' })
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)
  const selectionRef = useRef(0)

  const errors = validateAll(rows, administrator)
  const invalid = errors.filter(r => r.length).length

  function downloadSample() {
    const sample = administrator
      ? [{ name: 'Example Candidate', email: 'candidate2@example.com', password: 'Choose-a-unique-password' }]
      : [{ prompt: 'Which number is prime?', kind: 'single', choices: ['4', '7', '8', '9'], correct: 1, correctSet: [], marks: 1, topic: 'Mathematics', difficulty: 'easy' }]
    const url = URL.createObjectURL(new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'import-sample.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  async function handleFileChange(e) {
    const version = ++selectionRef.current
    setRows([])
    setStatus({ message: '', kind: '' })
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setStatus({ message: 'Reading file…', kind: '' })
    try {
      if (file.size > 1000000) throw new Error('Choose a JSON file smaller than 1 MB.')
      const parsed = JSON.parse(await file.text())
      if (selectionRef.current !== version) return
      if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 200) throw new Error('The file must contain a JSON array of 1–200 records.')
      setRows(parsed.map(item => item && typeof item === 'object' && !Array.isArray(item) ? { ...item } : item))
      setStatus({ message: '', kind: '' })
    } catch (err) {
      if (selectionRef.current !== version) return
      setRows([])
      setStatus({ message: err.message, kind: 'error' })
    }
  }

  function updateRow(index, patch) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r))
  }

  function removeRow(index) {
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  async function handleImport() {
    if (invalid > 0 || !rows.length || importing) return
    setImporting(true)
    setStatus({ message: 'Importing reviewed records…', kind: '' })
    try {
      const result = await examRequest('bulk_import', { rows })
      setRows([])
      setStatus({ message: `${result.imported} ${result.imported === 1 ? 'record' : 'records'} imported successfully.`, kind: 'success' })
    } catch (err) {
      setStatus({ message: err.message, kind: 'error' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <Breadcrumb back="Back to Examinations" backHref="/workspace" current="Bulk import" />
      <PageHeader title="Bulk import" description={
        administrator ? 'Import candidate accounts. Each record needs a name, email, and password of at least 12 characters.' :
        'Import question-bank records. Use single, multiple, or written for kind.'
      } />

      <Panel className="mb-4">
        <p className="text-sm text-muted mb-4">Upload a JSON array with up to 200 records. Review the preview, then confirm the import.</p>
        <div className="flex gap-3 flex-wrap">
          <Button variant="secondary" onClick={downloadSample}>Download sample JSON</Button>
          <label className="btn-secondary cursor-pointer">
            Choose JSON file
            <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" onChange={handleFileChange} />
          </label>
        </div>
        {fileName && <p className="text-muted text-xs mt-2">{fileName}</p>}
        {status.message && (
          <p className={`text-sm mt-3 ${status.kind === 'error' ? 'text-error' : status.kind === 'success' ? 'text-[#336548]' : 'text-muted'}`}>
            {status.message}
          </p>
        )}
      </Panel>

      {rows.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2>File preview</h2>
              <p className="text-sm text-muted">{fileName} · {rows.length} records · {invalid ? <strong className="text-error">{invalid} with errors</strong> : <span className="text-[#336548]">All rows valid</span>}</p>
            </div>
            <span className={`pill ${invalid ? '' : 'pill-available'}`}>{invalid ? 'Needs review' : 'Ready to import'}</span>
          </div>

          <div className="space-y-3 mb-4">
            {rows.map((row, index) => {
              const rowErrors = errors[index]
              return (
                <Panel key={index} className={rowErrors.length ? 'border-error' : ''}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">Row {index + 1} · {typeof (administrator ? row?.name : row?.prompt) === 'string' ? (administrator ? row.name : row.prompt).trim() || 'Untitled record' : 'Untitled record'}</h3>
                    <div className="flex gap-2 items-center">
                      <span className={`pill ${rowErrors.length ? 'pill-disabled' : 'pill-available'}`}>
                        {rowErrors.length ? `${rowErrors.length} error${rowErrors.length > 1 ? 's' : ''}` : 'Ready'}
                      </span>
                      <button className="btn-link text-xs text-error" onClick={() => removeRow(index)}>Remove</button>
                    </div>
                  </div>
                  {rowErrors.length > 0 && (
                    <ul className="text-error text-xs mb-2 list-disc list-inside">
                      {rowErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                  {administrator ? (
                    <div className="grid grid-cols-3 gap-2">
                      <label className="form-label text-xs">Full name <input className="form-input text-xs" value={row.name ?? ''} onChange={e => updateRow(index, { name: e.target.value })} maxLength={100} /></label>
                      <label className="form-label text-xs">Email <input className="form-input text-xs" type="email" value={row.email ?? ''} onChange={e => updateRow(index, { email: e.target.value })} /></label>
                      <label className="form-label text-xs">Password <input className="form-input text-xs" value={row.password ?? ''} onChange={e => updateRow(index, { password: e.target.value })} /></label>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="form-label text-xs">Question <textarea className="form-textarea text-xs" rows={2} value={row.prompt ?? ''} onChange={e => updateRow(index, { prompt: e.target.value })} /></label>
                      <div className="grid grid-cols-4 gap-2">
                        <label className="form-label text-xs">Type
                          <select className="form-select text-xs" value={row.kind || 'single'} onChange={e => updateRow(index, { kind: e.target.value })}>
                            <option value="single">single</option>
                            <option value="multiple">multiple</option>
                            <option value="written">written</option>
                          </select>
                        </label>
                        <label className="form-label text-xs">Topic <input className="form-input text-xs" value={row.topic ?? ''} onChange={e => updateRow(index, { topic: e.target.value })} /></label>
                        <label className="form-label text-xs">Difficulty
                          <select className="form-select text-xs" value={row.difficulty || 'easy'} onChange={e => updateRow(index, { difficulty: e.target.value })}>
                            <option>easy</option><option>medium</option><option>hard</option>
                          </select>
                        </label>
                        <label className="form-label text-xs">Marks <input className="form-input text-xs" type="number" min={1} max={100} value={row.marks ?? 1} onChange={e => updateRow(index, { marks: Number(e.target.value) })} /></label>
                      </div>
                    </div>
                  )}
                </Panel>
              )
            })}
          </div>

          <div className="flex gap-3 items-center">
            <Button variant="primary" onClick={handleImport} disabled={invalid > 0 || importing}>
              {importing ? 'Importing…' : `Confirm and import ${rows.length} record${rows.length > 1 ? 's' : ''}`}
            </Button>
            {invalid > 0 && <p className="text-muted text-sm">{invalid} row{invalid > 1 ? 's' : ''} need fixing before import.</p>}
          </div>
        </>
      )}
    </div>
  )
}
