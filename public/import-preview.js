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
  if (!Array.isArray(record.choices) || record.choices.length !== 4 || record.choices.some(choice => !text(choice) || text(choice).length > 500)) errors.push('Provide four choices, each containing 1–500 characters.')
  if (!Number.isInteger(record.correct) || record.correct < 0 || record.correct > 3) errors.push('Correct choice must be an index from 0 to 3.')
  if (!Number.isInteger(record.marks) || record.marks < 1 || record.marks > 100) errors.push('Marks must be an integer from 1 to 100.')
  if (!['easy','medium','hard'].includes(record.difficulty)) errors.push('Difficulty must be easy, medium, or hard.')
  if (typeof record.topic !== 'string') errors.push('Provide a topic.')
  if (record.kind === 'multiple' && (!Array.isArray(record.correctSet) || !record.correctSet.length ||
    record.correctSet.some(index => !Number.isInteger(index) || index < 0 || index > 3))) errors.push('Provide correctSet with one or more choice indexes from 0 to 3.')
  return errors
}

export function bindImportPreview(administrator, safe, examRequest) {
  const form = document.querySelector('#import-form')
  const input = document.querySelector('#import-file')
  const preview = document.querySelector('#import-preview')
  const status = document.querySelector('#import-status')
  const confirm = document.querySelector('#confirm-import')
  let reviewedRows = null
  let selection = 0
  let importing = false

  input.onchange = async () => {
    const version = ++selection
    reviewedRows = null
    confirm.disabled = true
    confirm.textContent = 'Confirm import'
    status.textContent = ''
    preview.replaceChildren()
    const file = input.files[0]
    if (!file) return
    preview.innerHTML = '<p>Reading file…</p>'
    try {
      if (file.size > 1000000) throw new Error('Choose a JSON file smaller than 1 MB.')
      const rows = JSON.parse(await file.text())
      if (version !== selection) return
      if (!Array.isArray(rows) || rows.length < 1 || rows.length > 200) throw new Error('The file must contain a JSON array of 1–200 records.')
      const errors = rows.map(row => recordErrors(row, administrator))
      if (administrator) {
        const emails = new Set()
        rows.forEach((row, index) => {
          const email = typeof row?.email === 'string' ? row.email.trim().toLowerCase() : ''
          if (email && emails.has(email)) errors[index].push('Email is repeated in this file.')
          emails.add(email)
        })
      }
      const invalid = errors.filter(row => row.length).length
      preview.innerHTML = '<h2>File preview</h2><p>' + safe(file.name) + ' · ' + rows.length + ' records · ' + invalid + ' rows with errors</p>' +
        '<p>' + (invalid ? 'Correct the errors and select the updated file.' : 'Review the records below, then confirm the import.') + '</p>' +
        rows.map((row, index) => {
          const title = administrator ? row?.name : row?.prompt
          const record = row && typeof row === 'object' && !Array.isArray(row) ? {...row} : row
          if (administrator && record && typeof record === 'object' && 'password' in record) record.password = '[hidden]'
          return '<article class="import-record"><h3>Row ' + (index + 1) + ' · ' + safe(typeof title === 'string' ? title : 'Invalid record') + '</h3>' +
            (errors[index].length ? '<ul class="form-error">' + errors[index].map(error => '<li>' + safe(error) + '</li>').join('') + '</ul>' : '<p class="muted">Ready to import</p>') +
            '<details><summary>View record</summary><pre>' + safe(JSON.stringify(record, null, 2)) + '</pre></details></article>'
        }).join('')
      if (!invalid) {
        reviewedRows = rows
        confirm.disabled = false
        confirm.textContent = 'Confirm and import ' + rows.length + ' records'
      }
    } catch (error) {
      if (version !== selection) return
      preview.replaceChildren()
      status.textContent = error.message
    }
  }
  form.onsubmit = async event => {
    event.preventDefault()
    if (!reviewedRows || importing) return
    importing = true
    confirm.disabled = true
    input.disabled = true
    status.textContent = 'Importing reviewed records…'
    try {
      const result = await examRequest('bulk_import', {rows: reviewedRows})
      reviewedRows = null
      confirm.textContent = 'Import complete'
      status.textContent = result.imported + ' records imported.'
    } catch (error) {
      status.textContent = error.message
      confirm.disabled = false
    } finally {
      importing = false
      input.disabled = false
    }
  }
}
