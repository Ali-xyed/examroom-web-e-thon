import { useState, useEffect } from 'react'
import { examRequest } from '../api.js'
import { PageHeader, Panel, Button, FormError, Pill, Breadcrumb } from '../components/ui.jsx'

export default function UsersView({ notify }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [dialog, setDialog] = useState(null) // null | user object
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const PAGE_SIZE = 12

  async function load() {
    setLoading(true)
    try { setUsers(await examRequest('admin_list')) }
    catch (err) { notify(err.message, true) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u =>
    (u.name + ' ' + u.email).toLowerCase().includes(search.toLowerCase()) &&
    (!roleFilter || u.role === roleFilter) &&
    (!statusFilter || u.active === (statusFilter === 'active'))
  )
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pages - 1)
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    setFormBusy(true)
    const data = new FormData(e.currentTarget)
    const payload = {
      id: dialog?.id,
      name: data.get('name'),
      email: data.get('email'),
      role: data.get('role'),
      active: data.get('active') === 'true',
    }
    if (!dialog?.id) payload.password = data.get('password')
    try {
      await examRequest(dialog?.id ? 'admin_save' : 'admin_save', payload)
      notify(dialog?.id ? 'Account updated.' : 'Account created.')
      setDialog(null)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormBusy(false)
    }
  }

  return (
    <div>
      <Breadcrumb back="Back to Examinations" backHref="/workspace" current="User management" />
      <PageHeader
        title="User management"
        description="Manage account access and permissions."
        action={<Button variant="primary" onClick={() => { setFormError(''); setDialog({}) }}>＋ Create account</Button>}
      />

      <Panel>
        <div className="flex flex-wrap gap-3 mb-4">
          <label className="form-label flex-1 mb-0 min-w-[200px] text-sm">
            Search
            <input className="form-input" type="search" placeholder="Name or email" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }} />
          </label>
          <label className="form-label mb-0 text-sm">
            Role
            <select className="form-select" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(0) }}>
              <option value="">All roles</option>
              <option value="candidate">Candidate</option>
              <option value="examiner">Examiner</option>
              <option value="administrator">Administrator</option>
            </select>
          </label>
          <label className="form-label mb-0 text-sm">
            Status
            <select className="form-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>

        <p className="text-sm text-muted mb-3">{filtered.length} of {users.length} accounts</p>

        {loading ? <p className="text-muted text-sm">Loading…</p> : paged.length === 0 ? (
          <p className="text-muted text-sm">No matching accounts.</p>
        ) : (
          <div className="space-y-2">
            {paged.map(user => (
              <article key={user.id} className="flex items-center gap-4 py-3 border-b border-line last:border-0">
                <div className="w-9 h-9 rounded-full bg-soft text-ink font-bold flex items-center justify-center flex-none text-sm">
                  {user.name.trim()[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="block text-sm">{user.name}</strong>
                  <span className="text-muted text-xs">{user.email}</span>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  <span className="text-xs text-muted capitalize">{user.role}</span>
                  <Pill variant={user.active ? 'available' : 'disabled'}>{user.active ? 'Active' : 'Disabled'}</Pill>
                  <Button variant="secondary" className="text-xs" onClick={() => { setFormError(''); setDialog(user) }}>Edit</Button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted">Page {safePage + 1} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={safePage === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="secondary" disabled={safePage >= pages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </Panel>

      {/* Account dialog */}
      {dialog !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="panel p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-bold text-lg">{dialog.id ? 'Edit account' : 'Create account'}</h2>
                <p className="text-muted text-sm">{dialog.id ? dialog.email : 'Add a user and assign their role.'}</p>
              </div>
              <button className="btn-link text-muted text-xl" onClick={() => setDialog(null)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="form-label text-sm">Full name <input className="form-input" name="name" required maxLength={100} defaultValue={dialog.name || ''} /></label>
              {!dialog.id && <label className="form-label text-sm">Email <input className="form-input" type="email" name="email" required defaultValue={dialog.email || ''} /></label>}
              {!dialog.id && <label className="form-label text-sm">Password (min 12 chars) <input className="form-input" type="text" name="password" required minLength={12} /></label>}
              <label className="form-label text-sm">Role
                <select className="form-select" name="role" defaultValue={dialog.role || 'candidate'}>
                  <option value="candidate">Candidate</option>
                  <option value="examiner">Examiner</option>
                  <option value="administrator">Administrator</option>
                </select>
              </label>
              {dialog.id && (
                <label className="form-label text-sm">Status
                  <select className="form-select" name="active" defaultValue={String(dialog.active !== false)}>
                    <option value="true">Active</option>
                    <option value="false">Disabled</option>
                  </select>
                </label>
              )}
              <FormError>{formError}</FormError>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={formBusy}>
                  {formBusy ? 'Saving…' : dialog.id ? 'Save changes' : 'Create account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
