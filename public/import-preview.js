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
  if (!['easy', 'medium', 'hard'].includes(record.difficulty)) errors.push('Difficulty must be easy, medium, or hard.')
  if (typeof record.topic !== 'string') errors.push('Provide a topic.')
  if (record.kind === 'multiple' && (!Array.isArray(record.correctSet) || !record.correctSet.length ||
    record.correctSet.some(index => !Number.isInteger(index) || index < 0 || index > 3))) errors.push('Provide correctSet with one or more choice indexes from 0 to 3.')
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

export function bindImportPreview(administrator, safe, examRequest) {
  const form = document.querySelector('#import-form')
  const input = document.querySelector('#import-file')
  const preview = document.querySelector('#import-preview')
  const status = document.querySelector('#import-status')
  const confirm = document.querySelector('#confirm-import')
  let rows = []
  let fileName = ''
  let selection = 0
  let importing = false

  function setStatus(message, kind = '') {
    status.textContent = message
    status.className = kind === 'error' ? 'status-banner error' : kind === 'success' ? 'status-banner success' : ''
  }

  function renderPreview() {
    if (!rows.length) {
      preview.replaceChildren()
      confirm.disabled = true
      confirm.textContent = 'Confirm import'
      return
    }
    const errors = validateAll(rows, administrator)
    const invalid = errors.filter(row => row.length).length

    preview.innerHTML = `<div class="import-preview-header">
        <div><h2>File preview &amp; editor</h2>
          <p class="muted">${safe(fileName)} · ${rows.length} ${rows.length === 1 ? 'record' : 'records'} · ${invalid ? `<strong class="text-error">${invalid} ${invalid === 1 ? 'row' : 'rows'} with errors</strong>` : '<span class="text-success">All rows valid</span>'}</p>
        </div>
        <span class="status-badge ${invalid ? 'warning' : 'success'}">${invalid ? 'Needs review' : 'Ready to import'}</span>
      </div>
      <p class="muted">${invalid ? 'Edit the fields below to fix any errors, or remove invalid rows.' : 'You can edit any field below before confirming the import.'}</p>
      <div class="import-records-list">
        ${rows.map((row, index) => {
          const isObj = row && typeof row === 'object' && !Array.isArray(row)
          const rowErrors = errors[index]
          const title = administrator ? row?.name : row?.prompt
          return `<article class="import-record ${rowErrors.length ? 'has-error' : ''}" data-row="${index}">
            <div class="import-record-head">
              <h3>Row ${index + 1} · ${safe(typeof title === 'string' && title.trim() ? title : 'Untitled record')}</h3>
              <div class="import-record-actions">
                <span class="pill ${rowErrors.length ? 'disabled' : 'available'}" data-row-badge>${rowErrors.length ? rowErrors.length + (rowErrors.length === 1 ? ' error' : ' errors') : 'Ready'}</span>
                <button type="button" class="link-button" data-remove-row="${index}">Remove</button>
              </div>
            </div>
            <div data-row-errors>${rowErrors.length ? '<ul class="form-error">' + rowErrors.map(error => '<li>' + safe(error) + '</li>').join('') + '</ul>' : ''}</div>
            ${!isObj ? '<p class="form-error">Invalid JSON object. Remove this row or fix your JSON file.</p>' : administrator ? `
              <div class="fields import-edit-fields">
                <label>Full name<input type="text" data-field="name" value="${safe(row.name ?? '')}" maxlength="100"></label>
                <label>Email address<input type="email" data-field="email" value="${safe(row.email ?? '')}"></label>
                <label>Password<input type="text" data-field="password" value="${safe(row.password ?? '')}"></label>
              </div>` : `
              <div class="import-edit-fields">
                <label>Question prompt<textarea rows="2" data-field="prompt" maxlength="2000">${safe(row.prompt ?? '')}</textarea></label>
                <div class="fields">
                  <label>Type<select data-field="kind">${['single', 'multiple', 'written'].map(k => `<option value="${k}" ${row.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
                  <label>Topic<input type="text" data-field="topic" value="${safe(row.topic ?? '')}" maxlength="100"></label>
                  <label>Difficulty<select data-field="difficulty">${['easy', 'medium', 'hard'].map(d => `<option value="${d}" ${row.difficulty === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
                  <label>Marks<input type="number" min="1" max="100" data-field="marks" value="${Number.isInteger(row.marks) ? row.marks : 1}"></label>
                </div>
                <div class="fields">
                  ${[0, 1, 2, 3].map(ci => `<label>Choice ${'ABCD'[ci]}<input type="text" data-choice="${ci}" value="${safe(Array.isArray(row.choices) ? (row.choices[ci] ?? '') : '')}" maxlength="500"></label>`).join('')}
                </div>
                <div class="fields">
                  <label>Correct choice<select data-field="correct">${['A', 'B', 'C', 'D'].map((l, ci) => `<option value="${ci}" ${row.correct === ci ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
                </div>
              </div>`}
          </article>`
        }).join('')}
      </div>`

    updateSummaryAndButton()
  }

  function updateSummaryAndButton() {
    const errors = validateAll(rows, administrator)
    const invalid = errors.filter(r => r.length).length
    rows.forEach((_, index) => {
      const card = preview.querySelector(`[data-row="${index}"]`)
      if (!card) return
      const rowErrors = errors[index]
      card.classList.toggle('has-error', rowErrors.length > 0)
      const badge = card.querySelector('[data-row-badge]')
      if (badge) {
        badge.className = `pill ${rowErrors.length ? 'disabled' : 'available'}`
        badge.textContent = rowErrors.length ? rowErrors.length + (rowErrors.length === 1 ? ' error' : ' errors') : 'Ready'
      }
      const errSlot = card.querySelector('[data-row-errors]')
      if (errSlot) {
        errSlot.innerHTML = rowErrors.length ? '<ul class="form-error">' + rowErrors.map(e => '<li>' + safe(e) + '</li>').join('') + '</ul>' : ''
      }
    })
    const headerBadge = preview.querySelector('.import-preview-header .status-badge')
    if (headerBadge) {
      headerBadge.className = `status-badge ${invalid ? 'warning' : 'success'}`
      headerBadge.textContent = invalid ? 'Needs review' : 'Ready to import'
    }
    const summaryP = preview.querySelector('.import-preview-header p')
    if (summaryP) {
      summaryP.innerHTML = `${safe(fileName)} · ${rows.length} ${rows.length === 1 ? 'record' : 'records'} · ${invalid ? `<strong class="text-error">${invalid} ${invalid === 1 ? 'row' : 'rows'} with errors</strong>` : '<span class="text-success">All rows valid</span>'}`
    }
    confirm.disabled = invalid > 0 || rows.length === 0
    confirm.textContent = invalid === 0 && rows.length > 0
      ? `Confirm and import ${rows.length} ${rows.length === 1 ? 'record' : 'records'}`
      : 'Confirm import'
  }

  preview.addEventListener('input', event => {
    const card = event.target.closest('[data-row]')
    if (!card) return
    const index = Number(card.dataset.row)
    const row = rows[index]
    if (!row || typeof row !== 'object') return
    const field = event.target.dataset.field
    const choiceIdx = event.target.dataset.choice
    if (field) {
      if (field === 'marks' || field === 'correct') row[field] = Number(event.target.value)
      else row[field] = event.target.value
      if (field === 'name' || field === 'prompt') {
        const heading = card.querySelector('h3')
        if (heading) heading.textContent = `Row ${index + 1} · ${event.target.value.trim() || 'Untitled record'}`
      }
    } else if (choiceIdx !== undefined) {
      if (!Array.isArray(row.choices)) row.choices = ['', '', '', '']
      row.choices[Number(choiceIdx)] = event.target.value
    }
    setStatus('')
    updateSummaryAndButton()
  })

  preview.addEventListener('click', event => {
    const removeBtn = event.target.closest('[data-remove-row]')
    if (!removeBtn) return
    const index = Number(removeBtn.dataset.removeRow)
    rows.splice(index, 1)
    setStatus('')
    renderPreview()
  })

  input.onchange = async () => {
    const version = ++selection
    rows = []
    confirm.disabled = true
    confirm.textContent = 'Confirm import'
    setStatus('')
    preview.replaceChildren()
    const file = input.files[0]
    if (!file) return
    fileName = file.name
    preview.innerHTML = '<p class="muted">Reading file…</p>'
    try {
      if (file.size > 1000000) throw new Error('Choose a JSON file smaller than 1 MB.')
      const parsed = JSON.parse(await file.text())
      if (version !== selection) return
      if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 200) throw new Error('The file must contain a JSON array of 1–200 records.')
      rows = parsed.map(item => item && typeof item === 'object' && !Array.isArray(item) ? { ...item } : item)
      renderPreview()
    } catch (error) {
      if (version !== selection) return
      rows = []
      preview.replaceChildren()
      setStatus(error.message, 'error')
    }
  }

  form.onsubmit = async event => {
    event.preventDefault()
    const errors = validateAll(rows, administrator)
    if (errors.some(r => r.length) || !rows.length || importing) return
    importing = true
    confirm.disabled = true
    input.disabled = true
    confirm.textContent = 'Importing…'
    setStatus('Importing reviewed records…')
    try {
      const result = await examRequest('bulk_import', { rows })
      rows = []
      preview.replaceChildren()
      confirm.textContent = 'Import complete'
      setStatus(`${result.imported} ${result.imported === 1 ? 'record' : 'records'} imported successfully.`, 'success')
    } catch (error) {
      setStatus(error.message, 'error')
      confirm.disabled = false
      confirm.textContent = `Confirm and import ${rows.length} ${rows.length === 1 ? 'record' : 'records'}`
    } finally {
      importing = false
      input.disabled = false
    }
  }
}
