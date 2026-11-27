import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { examRequest } from '../api.js'
import { PageHeader, Panel, Button, Breadcrumb } from '../components/ui.jsx'

export default function DisputesView({ notify, profile }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('pending')
  const examiner = profile.role === 'examiner'

  async function load() {
    setLoading(true)
    try { setData(await examRequest('disputes', { examId: id })) }
    catch (err) { notify(err.message, true) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  async function handleResolve(e, disputeId) {
    e.preventDefault()
    const fields = Object.fromEntries(new FormData(e.currentTarget))
    try {
      await examRequest('dispute_resolve', { examId: id, disputeId, ...fields })
      notify('Decision recorded.')
      await load()
    } catch (err) { notify(err.message, true) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const fields = Object.fromEntries(new FormData(e.currentTarget))
    try {
      await examRequest('dispute_create', { examId: id, ...fields })
      notify('Dispute submitted.')
      e.target.reset()
      await load()
    } catch (err) { notify(err.message, true) }
  }

  if (loading) return <p className="text-muted">Loading…</p>
  if (!data) return null

  const filtered = data.disputes.filter(d => filterStatus === 'all' || d.status === 'pending')

  return (
    <div>
      <Breadcrumb back={examiner ? 'Back to Manage exam' : 'Back to Examinations'}
        backHref={examiner ? `/workspace/manage/${id}` : '/workspace'} current="Disputes" />
      <PageHeader title={examiner ? 'Dispute queue' : 'Question and grade disputes'}
        description="Every decision is recorded."
        action={examiner ? <a href={`/workspace/audit/${id}`} className="btn-secondary">View audit log</a> : null} />

      {!examiner && data.questions?.length > 0 && (
        <Panel className="mb-4">
          <h2>Raise a dispute</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <label className="form-label text-sm">Question
              <select className="form-select" name="questionId" required>
                {data.questions.map(q => <option key={q.id} value={q.id}>{q.prompt}</option>)}
              </select>
            </label>
            <label className="form-label text-sm">Dispute type
              <select className="form-select" name="kind">
                <option value="question">Question clarity or content</option>
                <option value="grade">Published grade</option>
              </select>
            </label>
            <label className="form-label text-sm">Reason
              <textarea className="form-textarea" name="reason" minLength={10} maxLength={2000} required rows={3} />
            </label>
            <Button type="submit" variant="primary">Submit dispute</Button>
          </form>
        </Panel>
      )}

      <Panel>
        <div className="flex justify-between items-center mb-4">
          <h2 className="mb-0">{examiner ? 'Candidate disputes' : 'Your disputes'}</h2>
          <select className="form-select w-auto text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="all">All decisions</option>
          </select>
        </div>
        {filtered.length === 0 ? <p className="text-muted text-sm">No matching disputes.</p> : (
          <div className="space-y-4">
            {filtered.map(d => (
              <div key={d.id} className="border border-line rounded-lg p-4">
                <div className="mb-2">
                  <h3 className="font-semibold overflow-wrap-anywhere">{d.prompt}</h3>
                  <p className="text-sm text-muted">{d.candidate} · {d.kind} · <span className="pill">{d.status}</span></p>
                  <p className="text-sm whitespace-pre-wrap mt-1">{d.reason}</p>
                  <small className="text-muted text-xs">{new Date(d.created_at).toLocaleString()}</small>
                  {d.decision_reason && (
                    <p className="text-sm mt-1"><strong>Decision:</strong> {d.resolution} — {d.decision_reason}</p>
                  )}
                </div>
                {examiner && d.status === 'pending' && (
                  <form onSubmit={e => handleResolve(e, d.id)} className="space-y-2 border-t border-line pt-3">
                    <label className="form-label text-xs">Decision
                      <select className="form-select text-xs" name="resolution">
                        <option value="reject">Reject</option>
                        <option value="accept">Accept concern (no mark change)</option>
                        <option value="ambiguous">Ambiguous question · full marks for all</option>
                        {d.kind === 'grade' && <option value="grade">Accept and correct this candidate's grade</option>}
                      </select>
                    </label>
                    <label className="form-label text-xs">Decision reason
                      <textarea className="form-textarea text-xs" name="reason" minLength={10} maxLength={2000} rows={2} required />
                    </label>
                    <Button type="submit" variant="secondary" className="text-xs">Confirm decision</Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
