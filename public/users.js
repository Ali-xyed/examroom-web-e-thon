import { examRequest } from './api.js'

export async function manageUsers({show, safe, notify}) {
  let users = await examRequest('admin_list')
  let page = 0
  const pageSize = 12
  let busy = false
  let opener
  show(`<nav class="breadcrumb" aria-label="Breadcrumb"><a class="back" href="#">← Back to Examinations</a><span aria-hidden="true">/</span><span>User management</span></nav>
    <div class="heading"><div><h1>User management</h1><p>Manage account access and permissions.</p></div>
      <button class="primary" id="create-user" type="button">＋ Create account</button></div>
    <section class="panel users-panel" aria-label="Accounts">
      <div class="users-filters">
        <label>Search accounts<input id="user-search" type="search" placeholder="Search name or email" autocomplete="off"></label>
        <label>Role<select id="user-role"><option value="">All roles</option><option value="candidate">Candidate</option><option value="examiner">Examiner</option><option value="administrator">Administrator</option></select></label>
        <label>Status<select id="user-status"><option value="">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
      </div>
      <p class="users-count" id="users-count" role="status"></p>
      <div id="users-list"></div>
      <div class="users-pagination"><span id="users-page"></span><div>
        <button class="secondary" id="users-previous" type="button">Previous</button>
        <button class="secondary" id="users-next" type="button">Next</button></div></div>
    </section>
    <dialog class="account-dialog" id="account-dialog" aria-labelledby="account-title">
      <div class="account-dialog-heading"><div><h2 id="account-title"></h2><p id="account-subtitle"></p></div>
        <button class="account-close secondary" type="button" id="close-account" aria-label="Close account form">×</button></div>
      <form id="account-form">
        <div class="account-fields" id="account-fields"></div>
        <p id="account-error" class="form-error" role="alert"></p>
        <div class="account-footer"><button class="secondary" id="cancel-account" type="button">Cancel</button><button class="primary" id="save-account" type="submit">Save account</button></div>
      </form>
    </dialog>`)
  const dialog = document.querySelector('#account-dialog')
  const list = document.querySelector('#users-list')
  const search = document.querySelector('#user-search')
  const role = document.querySelector('#user-role')
  const status = document.querySelector('#user-status')
  const form = document.querySelector('#account-form')
  const save = document.querySelector('#save-account')

  function render() {
    const term = search.value.trim().toLowerCase()
    const filtered = users.filter(user =>
      (user.name+' '+user.email).toLowerCase().includes(term) &&
      (!role.value || user.role === role.value) &&
      (!status.value || user.active === (status.value === 'active')))
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
    page = Math.min(page, pages - 1)
    document.querySelector('#users-count').textContent = filtered.length + ' of ' + users.length + ' accounts'
    list.innerHTML = filtered.slice(page * pageSize, (page + 1) * pageSize).map(user => `
      <article class="record-row user-row">
        <div class="user-avatar" aria-hidden="true">${safe(user.name.trim().slice(0,1).toUpperCase())}</div>
        <div class="record-copy"><strong>${safe(user.name)}</strong><span class="record-description">${safe(user.email)}</span></div>
        <div class="record-meta"><span class="record-role">${safe(user.role)}</span><span class="pill ${user.active ? 'available' : 'disabled'}">${user.active ? 'Active' : 'Disabled'}</span></div>
        <button class="secondary" type="button" data-user="${user.id}" aria-label="Edit account for ${safe(user.name)}">Edit account</button>
      </article>`).join('') || '<div class="users-empty"><h2>No matching accounts</h2><p>Try another name, email, role, or status.</p></div>'
    document.querySelector('#users-page').textContent = 'Page ' + (page + 1) + ' of ' + pages
    document.querySelector('#users-previous').disabled = page === 0
    document.querySelector('#users-next').disabled = page >= pages - 1
  }

  function close() {
    if (busy) return
    dialog.close()
    form.reset()
    document.querySelector('#account-fields').replaceChildren()
    if (opener?.isConnected) opener.focus({preventScroll:true})
    else document.querySelector('#create-user').focus({preventScroll:true})
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  document.querySelector('#close-account').onclick = close
  document.querySelector('#cancel-account').onclick = close

  function edit(user = {}, trigger) {
    opener = trigger
    document.querySelector('#account-title').textContent = user.id ? 'Edit account' : 'Create account'
    document.querySelector('#account-subtitle').textContent = user.id ? user.email : 'Add a user and assign their role.'
    document.querySelector('#account-error').textContent = ''
    save.textContent = user.id ? 'Save changes' : 'Create account'
    document.querySelector('#account-fields').innerHTML = `
      <label>Full name<input name="name" required maxlength="100" autocomplete="off" value="${safe(user.name)}"></label>
      ${user.id ? '' : '<label>Email address<input type="email" name="email" required autocomplete="off" placeholder="name@institution.edu"></label>'}
      <label>Role<select name="role">${['candidate','examiner','administrator'].map(value=>`<option value="${value}" ${user.role === value ? 'selected' : ''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></label>
      <div class="password-wrap"><label>${user.id ? 'New password (optional)' : 'Password'}<input id="account-password" name="password" type="password" minlength="12" ${user.id ? '' : 'required'} autocomplete="new-password" aria-describedby="account-password-help"></label>
        <button id="password-toggle" type="button" aria-label="Show password" aria-controls="account-password" aria-pressed="false"><span aria-hidden="true"></span></button></div>
      <p class="account-hint" id="account-password-help">${user.id ? 'Enter at least 12 characters to reset the password.' : 'Use at least 12 characters.'}</p>
      <label class="account-access"><span><strong>Account access</strong><small>Allow this user to sign in and use their workspace.</small></span><input type="checkbox" name="active" ${user.active !== false ? 'checked' : ''}></label>`
    const password = form.elements.password
    const toggle = form.querySelector('#password-toggle')
    toggle.onclick = () => {
      const visible = password.type === 'password'
      password.type = visible ? 'text' : 'password'
      toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password')
      toggle.setAttribute('aria-pressed', String(visible))
      toggle.classList.toggle('revealed', visible)
    }
    form.onsubmit = async event => {
      event.preventDefault()
      if (busy) return
      const payload = Object.fromEntries(new FormData(form))
      payload.id = user.id
      payload.active = form.elements.active.checked
      busy = true
      const label = save.textContent
      save.textContent = 'Saving…'
      dialog.querySelectorAll('button, input, select').forEach(element => { element.disabled = true })
      try {
        users = await examRequest('admin_save', payload)
        render()
        // Restore focus to the updated row when it remains in the filtered list.
        opener = user.id ? list.querySelector('[data-user="'+user.id+'"]') : document.querySelector('#create-user')
        busy = false
        close()
        notify(user.id ? 'Account updated.' : 'Account created.')
      } catch (error) {
        document.querySelector('#account-error').textContent = error.message
      } finally {
        busy = false
        dialog.querySelectorAll('button, input, select').forEach(element => { element.disabled = false })
        save.textContent = label
      }
    }
    dialog.showModal()
    form.elements.name.focus()
  }
  document.querySelector('#create-user').onclick = event => edit({}, event.currentTarget)
  list.onclick = event => {
    const button = event.target.closest('[data-user]')
    if (button) edit(users.find(user => user.id === button.dataset.user), button)
  }
  for (const element of [search,role,status]) element.addEventListener('input', () => { page = 0; render() })
  document.querySelector('#users-previous').onclick = () => { page--; render() }
  document.querySelector('#users-next').onclick = () => { page++; render() }
  render()
}
