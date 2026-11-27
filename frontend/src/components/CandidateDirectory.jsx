import { useState, useEffect } from 'react'
import { examRequest } from '../api.js'
import { Pill, FormError, Button } from '../components/ui.jsx'

export default function CandidateDirectory({ examId, notify }) {
  const [candidates, setCandidates] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [enrollBusy, setEnrollBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const result = await examRequest('candidate_directory', { examId })
      setCandidates(result)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [examId])

  if (error) return <p className="text-error text-sm">{error}</p>
  if (!candidates) return <p className="text-muted text-sm">Loading candidates…</p>

  const matches = candidates.filter(c =>
    (c.name + ' ' + c.email).toLowerCase().includes(search.toLowerCase()) &&
    (filter === 'all' || (filter === 'enrolled' ? c.enrolled : !c.enrolled && c.active))
  )

  async function handleEnroll(email) {
    if (enrollBusy) return
    setEnrollBusy(true)
    setError('')
    try {
      await examRequest('enroll', { examId, email })
      await load()
      notify('Candidate enrolled.')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnrollBusy(false)
    }
  }

  const enrolled = candidates.filter(c => c.enrolled).length

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <label className="form-label flex-1 mb-0">
          <span className="sr-only">Search candidates</span>
          <input
            className="form-input"
            type="search"
            placeholder="Search by name or email"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        <label className="form-label mb-0">
          <span className="sr-only">Show</span>
          <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="enrolled">Enrolled</option>
          </select>
        </label>
      </div>
      <p className="text-muted text-sm mb-2">{enrolled} enrolled · {matches.length} shown</p>
      <FormError>{error}</FormError>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {matches.length === 0 ? (
          <p className="text-muted text-sm">No candidates match.</p>
        ) : (
          matches.map(c => (
            <article key={c.id ?? c.email} className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-0">
              <div className="min-w-0">
                <strong className="block text-sm">{c.name}</strong>
                <span className="text-muted text-xs">{c.email}</span>
                {!c.active && <Pill variant="disabled" className="ml-2">Disabled</Pill>}
                {c.submittedAt && (
                  <small className="block text-muted text-xs">
                    Submitted {new Date(c.submittedAt).toLocaleString()}
                  </small>
                )}
              </div>
              {c.enrolled ? (
                <Pill variant="available">
                  {c.submittedAt ? 'Submitted' : c.startedAt ? 'In progress' : 'Enrolled'}
                </Pill>
              ) : (
                <Button
                  variant="secondary"
                  disabled={!c.active || enrollBusy}
                  onClick={() => handleEnroll(c.email)}
                >
                  Enroll
                </Button>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  )
}
