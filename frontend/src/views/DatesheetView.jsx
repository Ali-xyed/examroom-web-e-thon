import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { examRequest, sessionToken } from '../api.js'
import { PageHeader, Panel, Button, Breadcrumb } from '../components/ui.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' })

export default function DatesheetView({ notify }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [mailStatus, setMailStatus] = useState('')

  useEffect(() => {
    examRequest('datesheet', { examId: id })
      .then(setData)
      .catch(err => notify(err.message, true))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSend() {
    setSending(true)
    setMailStatus('Sending individual datesheets…')
    let sent = 0, failed = 0
    try {
      for (let batch = 0; batch < 100; batch++) {
        const token = await sessionToken()
        const response = await fetch(API_URL + '/api/datesheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ examId: id }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Email delivery failed.')
        sent += result.sent
        failed += result.failed
        setMailStatus(`${sent} sent · ${failed} failed`)
        if (!result.processed || result.failed || result.processed < 10) break
      }
      notify('Datesheet delivery finished.')
      setMailStatus(prev => prev + (failed ? ' · Failed recipients can be retried.' : ' · Complete.'))
    } catch (err) {
      setMailStatus(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>
  if (!data) return null

  const { exam, candidates } = data
  const hasDeliverable = candidates.some(c => c.deliverable && c.state !== 'sent')

  return (
    <div>
      <Breadcrumb back="Back to Manage exam" backHref={`/workspace/manage/${id}`} current="Datesheet email" />
      <PageHeader title="Datesheet email" />
      <Panel>
        <h2>{exam.title}</h2>
        <dl className="flex flex-wrap gap-y-1 gap-x-6 my-3 text-sm">
          <div><dt className="text-muted text-xs">Opens</dt><dd className="font-semibold">{dateFormat.format(new Date(exam.opens_at))}</dd></div>
          <div><dt className="text-muted text-xs">Closes</dt><dd className="font-semibold">{dateFormat.format(new Date(exam.closes_at))}</dd></div>
          <div><dt className="text-muted text-xs">Duration</dt><dd className="font-semibold">{exam.duration} minutes</dd></div>
        </dl>
        <p className="text-sm text-muted mb-4">Emails include the schedule, instructions, and examination login link. Each candidate receives a separate email.</p>
        <p className="text-sm whitespace-pre-wrap mb-4">{exam.instructions}</p>
        <h3 className="font-semibold mb-2">Recipient preview</h3>
        <div className="space-y-1 mb-4">
          {candidates.length === 0 ? <p className="text-muted text-sm">No enrolled candidates.</p> : (
            candidates.map(c => (
              <p key={c.id ?? c.email} className="text-sm">
                <strong>{c.name}</strong> · {c.email} · {!c.deliverable ? <span className="text-muted">Disabled account or demo address — skipped</span> : <span className="text-muted">{c.state}</span>}
              </p>
            ))
          )}
        </div>
        <Button variant="primary" onClick={handleSend} disabled={sending || !hasDeliverable}>
          {sending ? 'Sending…' : 'Send datesheet to pending recipients'}
        </Button>
        {mailStatus && <p className="text-sm text-muted mt-2">{mailStatus}</p>}
      </Panel>
    </div>
  )
}
