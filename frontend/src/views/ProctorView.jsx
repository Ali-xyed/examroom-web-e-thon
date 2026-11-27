import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { examRequest, sessionToken } from '../api.js'
import { PageHeader, Panel, Button, Breadcrumb } from '../components/ui.jsx'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const API_URL = import.meta.env.VITE_API_URL || ''

function priorityLabel(flagCount) {
  if (flagCount >= 2) return 'high'
  if (flagCount === 1) return 'medium'
  return 'low'
}

function PriorityBadge({ flagCount }) {
  const level = priorityLabel(flagCount)
  const styles = {
    high: 'bg-soft border border-line text-ink',
    medium: 'bg-soft border border-line text-muted',
    low: 'bg-surface border border-line text-muted',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${styles[level]}`}>
      {level}
    </span>
  )
}

export default function ProctorView({ notify, profile }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('snapshots') // 'snapshots' | 'incidents'
  const [incidentData, setIncidentData] = useState(null)
  const [reviewingId, setReviewingId] = useState(null)
  const [reviewNote, setReviewNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch independently so a monitor failure doesn't prevent captures from loading
      const [capturesResult, monitorResult] = await Promise.all([
        examRequest('proctor_captures', { examId: id }),
        examRequest('monitor', { examId: id }).catch(() => null),
      ])
      setData(capturesResult)
      setIncidentData(monitorResult)
    } catch (err) {
      notify(err.message, true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function getSignedUrl(captureId) {
    try {
      const token = await sessionToken()
      const res = await fetch(`${API_URL}/api/proctor/image/${captureId}`, {
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error('Could not get image URL')
      const { url } = await res.json()
      window.open(url, '_blank')
    } catch (err) {
      notify(err.message, true)
    }
  }

  async function markReviewed(captureId, action = 'reviewed', note = '') {
    try {
      const token = await sessionToken()
      const res = await fetch(`${API_URL}/api/proctor/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ captureId, action, note }),
      })
      if (!res.ok) {
        const err = await res.json()
        notify(err.error || 'Review failed', true)
        return
      }
      notify(action === 'escalated' ? 'Capture escalated.' : 'Capture marked as reviewed.')
      setReviewingId(null)
      setReviewNote('')
      load()
    } catch (err) {
      notify(err.message, true)
    }
  }

  async function markAllReviewed(candidateId) {
    const candidate = data?.candidates?.find(c => c.id === candidateId)
    if (!candidate) return
    const pending = candidate.captures.filter(c => c.status !== 'reviewed')
    for (const cap of pending) {
      await markReviewed(cap.id, 'reviewed', '')
    }
  }

  // Count images still in storage
  const storedCount = data?.candidates?.reduce((total, c) =>
    total + c.captures.filter(cap => cap.status === 'pending' || cap.status === 'escalated').length, 0
  ) ?? 0

  const examTitle = incidentData?.exam?.title || id

  if (loading) return (
    <div className="p-8">
      <p className="text-muted">Loading integrity review…</p>
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Breadcrumb
        back="Manage exam"
        backHref={`/workspace/manage/${id}`}
        current="Integrity review"
      />

      <PageHeader
        title={`Integrity review — ${examTitle}`}
        description="Camera snapshots grouped by candidate. Sorted by flag count. Indicators are a triage aid only — they are not conclusive evidence."
      />

      <p className="text-sm text-muted mb-6">
        {storedCount} {storedCount === 1 ? 'image' : 'images'} currently stored
      </p>

      {/* Tab switcher */}
      <div className="flex gap-6 border-b border-line mb-6">
        <button
          className={`pb-2 text-sm font-medium transition-colors ${tab === 'snapshots' ? 'border-b-2 border-ink text-ink' : 'text-muted hover:text-ink'}`}
          onClick={() => setTab('snapshots')}
        >
          Snapshots
        </button>
        <button
          className={`pb-2 text-sm font-medium transition-colors ${tab === 'incidents' ? 'border-b-2 border-ink text-ink' : 'text-muted hover:text-ink'}`}
          onClick={() => setTab('incidents')}
        >
          Incidents
        </button>
      </div>

      {tab === 'snapshots' && (
        <div className="space-y-6">
          {(!data?.candidates || data.candidates.length === 0) && (
            <Panel className="p-8 text-center">
              <p className="text-muted text-sm">No captures recorded for this exam.</p>
            </Panel>
          )}

          {data?.candidates
            ?.slice()
            .sort((a, b) => {
              const aFlags = a.captures.reduce((s, c) => s + (c.flags?.length || 0), 0)
              const bFlags = b.captures.reduce((s, c) => s + (c.flags?.length || 0), 0)
              return bFlags - aFlags
            })
            .map(candidate => {
              const flaggedCount = candidate.captures.filter(c => c.flags?.length > 0).length
              const sortedCaptures = [...candidate.captures].sort((a, b) =>
                (b.flags?.length || 0) - (a.flags?.length || 0)
              )
              const hasPending = candidate.captures.some(c => c.status !== 'reviewed')

              return (
                <Panel key={candidate.id} className="p-5">
                  <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-sm">{candidate.name}</p>
                      <p className="text-xs text-muted">{candidate.email}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {candidate.captures.length} captures, {flaggedCount} flagged
                      </p>
                    </div>
                    {hasPending && (
                      <Button
                        variant="secondary"
                        onClick={() => markAllReviewed(candidate.id)}
                      >
                        Mark all reviewed
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {sortedCaptures.map(capture => {
                      const flagCount = capture.flags?.length || 0
                      const isReviewed = capture.status === 'reviewed'
                      const isEscalated = capture.status === 'escalated'
                      const isReviewingThis = reviewingId === capture.id

                      return (
                        <div
                          key={capture.id}
                          className="flex items-start gap-4 p-3 rounded-lg border border-line bg-surface"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs text-muted">
                                {capture.taken_at
                                  ? dateFormat.format(new Date(capture.taken_at))
                                  : 'Unknown time'}
                              </span>
                              <PriorityBadge flagCount={flagCount} />
                              {isEscalated && (
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium border border-line text-ink bg-soft">
                                  Escalated
                                </span>
                              )}
                            </div>
                            {capture.flags?.length > 0 && (
                              <div className="flex gap-1 flex-wrap mb-1">
                                {capture.flags.map(flag => (
                                  <span key={flag} className="text-xs text-muted">
                                    {flag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {isReviewed && (
                              <p className="text-xs text-muted">
                                Reviewed{capture.reviewed_at ? ` ${dateFormat.format(new Date(capture.reviewed_at))}` : ''}
                                {capture.reviewer_note ? ` · ${capture.reviewer_note}` : ''}
                              </p>
                            )}

                            {/* Review note input */}
                            {isReviewingThis && (
                              <div className="mt-2 flex gap-2 items-start">
                                <input
                                  type="text"
                                  className="form-input text-xs flex-1"
                                  placeholder="Optional note…"
                                  value={reviewNote}
                                  onChange={e => setReviewNote(e.target.value)}
                                  maxLength={500}
                                />
                                <Button
                                  variant="primary"
                                  onClick={() => markReviewed(capture.id, 'reviewed', reviewNote)}
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => { setReviewingId(null); setReviewNote('') }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                            <Button
                              variant="secondary"
                              onClick={() => getSignedUrl(capture.id)}
                            >
                              View
                            </Button>
                            {!isReviewed && !isReviewingThis && (
                              <Button
                                variant="secondary"
                                onClick={() => { setReviewingId(capture.id); setReviewNote('') }}
                              >
                                Mark reviewed
                              </Button>
                            )}
                            {!isReviewed && !isEscalated && !isReviewingThis && (
                              <Button
                                variant="secondary"
                                onClick={() => markReviewed(capture.id, 'escalated')}
                              >
                                Escalate
                              </Button>
                            )}
                            {isEscalated && (
                              <Button
                                variant="secondary"
                                onClick={() => markReviewed(capture.id, 'reviewed')}
                              >
                                Un-escalate
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Panel>
              )
            })}
        </div>
      )}

      {tab === 'incidents' && (
        <div className="space-y-4">
          {(!incidentData?.integrity || incidentData.integrity.length === 0) && (
            <Panel className="p-8 text-center">
              <p className="text-muted text-sm">No integrity incidents recorded for this exam.</p>
            </Panel>
          )}

          {incidentData?.integrity?.map((entry, i) => {
            // The monitor API returns disconnects as an array of objects and timings as an array.
            // Derive counts from arrays so we never accidentally render an object as a React child.
            const disconnectCount = Array.isArray(entry.disconnects)
              ? entry.disconnects.length
              : (typeof entry.disconnects === 'number' ? entry.disconnects : null)
            const timingAnomalies = Array.isArray(entry.timings)
              ? entry.timings.filter(t => t.indicator === true).length
              : (typeof entry.timing_anomalies === 'number' ? entry.timing_anomalies : null)
            const tabSwitches = typeof entry.tab_switches === 'number' ? entry.tab_switches : null
            const pasteEvents = typeof entry.paste_events === 'number' ? entry.paste_events : null
            const fullscreenExits = typeof entry.fullscreen_exits === 'number' ? entry.fullscreen_exits : null

            return (
              <Panel key={i} className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{entry.name || 'Unknown candidate'}</p>
                  </div>
                </div>
                <div className="text-xs text-muted space-y-1">
                  {disconnectCount != null && disconnectCount > 0 && (
                    <p>Disconnects: <span className="text-ink font-medium">{disconnectCount}</span></p>
                  )}
                  {timingAnomalies != null && timingAnomalies > 0 && (
                    <p>Timing anomalies: <span className="text-ink font-medium">{timingAnomalies}</span></p>
                  )}
                  {tabSwitches != null && tabSwitches > 0 && (
                    <p>Tab / focus changes: <span className="text-ink font-medium">{tabSwitches}</span></p>
                  )}
                  {pasteEvents != null && pasteEvents > 0 && (
                    <p>Paste events: <span className="text-ink font-medium">{pasteEvents}</span></p>
                  )}
                  {fullscreenExits != null && fullscreenExits > 0 && (
                    <p>Fullscreen exits: <span className="text-ink font-medium">{fullscreenExits}</span></p>
                  )}
                  {!disconnectCount && !timingAnomalies && !tabSwitches && !pasteEvents && !fullscreenExits && (
                    <p className="italic">No anomalies detected.</p>
                  )}
                </div>
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}
