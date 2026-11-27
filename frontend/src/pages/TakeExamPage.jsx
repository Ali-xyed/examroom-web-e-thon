import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { examRequest, sessionToken } from '../api.js'
import { readLocal, writeLocal, removeLocal } from '../localStore.js'
import { integrityCapture, loadRecord, storeRecord } from '../attemptStore.js'
import { Button, useNotice, Notice } from '../components/ui.jsx'
import { useProctor } from '../hooks/useProctor.js'
import ProctorConsent from '../components/ProctorConsent.jsx'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function TakeExamPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { notice, notify } = useNotice()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submittedAt, setSubmittedAt] = useState(null)

  // Attempt state
  const [index, setIndex] = useState(0)
  const [questions, setQuestions] = useState([])
  const [saveStatus, setSaveStatus] = useState('All changes saved')
  const [showRetry, setShowRetry] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [announcements, setAnnouncements] = useState([])

  // Offline / pending
  const unsaved = useRef(new Map())
  const chain = useRef(Promise.resolve())
  const isSandbox = useRef(false)
  const pendingKey = 'pending-' + id
  const pending = useRef({})

  // Prefs and scratchpad
  const [textSize, setTextSize] = useState('16')
  const [layout, setLayout] = useState('side')
  const [scratchpad, setScratchpad] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  const cleanupRef = useRef(null)
  const timerRef = useRef(null)
  const remainingRef = useRef(0)
  const syncedAtRef = useRef(performance.now())
  const nextPollRef = useRef(0)
  const checkingExpiryRef = useRef(false)

  // Proctoring state
  const [showConsent, setShowConsent] = useState(false)
  const [proctorReady, setProctorReady] = useState(false)
  const isProctored = useRef(false)
  const API_URL = import.meta.env.VITE_API_URL || ''

  // Initialize proctor hook
  const proctor = useProctor({
    examId: id,
    attemptId: data?.attemptId || '',
    enabled: isProctored.current && proctorReady && !isSandbox.current,
    apiUrl: API_URL,
    getToken: sessionToken,
  })

  // Load attempt
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        let attemptData
        // Check if sandbox data was passed via route state (from SandboxView)
        const sandboxData = location.state?.sandboxData
        if (sandboxData) {
          attemptData = sandboxData
        } else {
          try {
            attemptData = await examRequest('start', { examId: id })
          } catch (err) {
            // Offline fallback
            const cached = readLocal('attempt-' + id, null)
            if (!navigator.onLine && cached) {
              attemptData = { ...cached, offline: true }
            } else {
              throw err
            }
          }
        }

        if (attemptData.submittedAt) {
          setSubmitted(true)
          setSubmittedAt(attemptData.submittedAt)
          setData(attemptData)
          setLoading(false)
          return
        }

        const sandbox = Boolean(attemptData.sandbox)
        isSandbox.current = sandbox
        attemptData.cachedAt ??= Date.now()
        if (!sandbox) writeLocal('attempt-' + id, attemptData)

        // Merge pending
        const pend = sandbox ? {} : readLocal(pendingKey, {})
        pending.current = pend
        const qs = attemptData.questions.map(q => ({
          ...q,
          ...(pend[q.id] || {}),
          selected: pend[q.id]?.selected ?? q.selected ?? [],
          choice: pend[q.id]?.choice ?? q.choice ?? null,
          written: pend[q.id]?.written ?? q.written ?? '',
          flagged: pend[q.id]?.flagged ?? q.flagged ?? false,
        }))

        // Load prefs
        const prefs = readLocal('preferences', { size: '16', layout: 'side' })
        setTextSize(prefs.size)
        setLayout(prefs.layout)
        const pad = readLocal((sandbox ? 'sandbox-' : '') + 'scratch-' + id, '')
        setScratchpad(pad)

        setQuestions(qs)
        setData(attemptData)

        // Proctoring setup
        const mode = attemptData.proctoring_mode || attemptData.exam?.proctoring_mode
        if (mode === 'snapshots' && !sandbox) {
          isProctored.current = true
          setShowConsent(true) // show consent before starting
        } else {
          setProctorReady(true) // no proctoring, skip
        }

        // Calculate remaining time
        const r =
          Date.parse(attemptData.deadline) -
          Date.parse(attemptData.serverTime) -
          (attemptData.offline ? Math.max(0, Date.now() - attemptData.cachedAt) : 0)
        remainingRef.current = r
        syncedAtRef.current = performance.now()

      } catch (err) {
        setLoadError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Set up timer and event listeners after data loads
  useEffect(() => {
    if (!data || submitted) return

    const sandbox = isSandbox.current

    function reconnect() {
      Object.values(pending.current).forEach(snapshot => {
        const q = questions.find(q => q.id === snapshot.questionId)
        if (q) enqueue(q, snapshot)
      })
    }

    function connectionLost() {
      if (!sandbox) setSaveStatus('Offline · Changes stay on this browser until synchronized')
    }

    window.addEventListener('online', reconnect)
    window.addEventListener('offline', connectionLost)

    // Integrity capture
    if (!sandbox) {
      cleanupRef.current = integrityCapture(
        id,
        examRequest,
        () => {},
        msg => notify(msg, true)
      )
    }

    // Tick timer
    async function tick() {
      // Poll announcements
      if (!sandbox && performance.now() > nextPollRef.current) {
        nextPollRef.current = performance.now() + 10000
        examRequest('announcements', { examId: id })
          .then(items => setAnnouncements(items))
          .catch(() => {})
      }

      const secs = Math.max(
        0,
        Math.ceil((remainingRef.current - (performance.now() - syncedAtRef.current)) / 1000)
      )
      setSeconds(secs)

      if (secs === 0 && !checkingExpiryRef.current && !submitting) {
        checkingExpiryRef.current = true
        try {
          const fresh = sandbox
            ? { submittedAt: new Date().toISOString() }
            : await examRequest('resume', { examId: id })
          if (fresh.submittedAt) {
            handleSubmitResponse(fresh)
          } else {
            remainingRef.current = Date.parse(fresh.deadline) - Date.parse(fresh.serverTime)
            syncedAtRef.current = performance.now()
          }
        } catch {
          setSaveStatus('Time expired. Reconnecting to confirm your submission…')
        } finally {
          setTimeout(() => { checkingExpiryRef.current = false }, 3000)
        }
      }
    }

    timerRef.current = setInterval(tick, 1000)
    tick()

    return () => {
      clearInterval(timerRef.current)
      cleanupRef.current?.()
      proctor.stop()
      window.removeEventListener('online', reconnect)
      window.removeEventListener('offline', connectionLost)
    }
  }, [data, submitted])

  // Consent handlers
  function handleConsentGranted() {
    setShowConsent(false)
    setProctorReady(true)
    proctor.startCamera().then(() => proctor.scheduleNext())
  }

  function handleConsentDenied() {
    setShowConsent(false)
    setProctorReady(true) // allow exam to continue
    proctor.recordMissed?.(['camera_denied'])
  }

  function handleSubmitResponse(response) {
    if (!response.submittedAt) return false
    if (!isSandbox.current) removeLocal(pendingKey)
    setSubmitted(true)
    setSubmittedAt(response.submittedAt)
    return true
  }

  function enqueue(q, overrideSnapshot) {
    const revision = Math.max(Date.now(), readLocal('revision', 0) + 1)
    writeLocal('revision', revision)
    const snapshot = overrideSnapshot ?? {
      revision,
      examId: id,
      questionId: q.id,
      choice: q.choice,
      flagged: q.flagged,
      selected: [...(q.selected || [])],
      written: q.written || '',
    }
    unsaved.current.set(q.id, snapshot)
    pending.current[q.id] = snapshot
    if (!isSandbox.current) writeLocal('attempt-' + id, { ...data, questions })
    if (!isSandbox.current && !writeLocal(pendingKey, pending.current))
      notify('Local recovery storage is unavailable. Keep this page open.', true)
    setSaveStatus(navigator.onLine ? 'Saving changes…' : 'Offline · Answers pending synchronization')
    setShowRetry(false)

    const savedSnapshot = snapshot
    chain.current = chain.current.then(async () => {
      if (unsaved.current.get(q.id) !== savedSnapshot) return
      try {
        const request = isSandbox.current
          ? async op => ({ serverTime: new Date().toISOString(), submittedAt: op === 'submit' ? new Date().toISOString() : null })
          : examRequest
        const response = await request('save', savedSnapshot)
        if (handleSubmitResponse(response)) return
        if (response.stale && unsaved.current.get(q.id) === savedSnapshot) {
          const fresh = await request('resume', { examId: id })
          if (handleSubmitResponse(fresh)) return
          const updated = fresh.questions.find(fq => fq.id === q.id)
          if (updated) {
            setQuestions(prev => prev.map(prevQ => prevQ.id === q.id ? { ...prevQ, ...updated } : prevQ))
          }
          notify('A newer answer was already accepted.')
        }
        // Check for server-scheduled next capture
        if (response?.next_capture_at) {
          proctor.setNextCaptureFromServer(response.next_capture_at)
        }
        remainingRef.current = Date.parse(data.deadline) - Date.parse(response.serverTime)
        syncedAtRef.current = performance.now()
        if (unsaved.current.get(q.id) === savedSnapshot) {
          unsaved.current.delete(q.id)
          delete pending.current[q.id]
          if (!isSandbox.current) writeLocal(pendingKey, pending.current)
        }
        if (!unsaved.current.size)
          setSaveStatus(isSandbox.current ? 'Preview changes saved locally' : 'All changes saved')
      } catch {
        setSaveStatus(navigator.onLine ? 'Saving failed · Answers pending synchronization' : 'Offline · Answers pending synchronization')
        setShowRetry(true)
      }
    })
  }

  function updateQuestion(id, patch) {
    setQuestions(prev => {
      const updated = prev.map(q => q.id === id ? { ...q, ...patch } : q)
      const q = updated.find(q => q.id === id)
      enqueue(q)
      return updated
    })
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    try {
      await chain.current
      if (unsaved.current.size) throw new Error('Retry saving your pending changes before submitting.')
      const request = isSandbox.current
        ? async () => ({ submittedAt: new Date().toISOString() })
        : examRequest
      const response = await request('submit', { examId: id })
      handleSubmitResponse(response)
    } catch (err) {
      setShowSubmitDialog(false)
      notify(err.message, true)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-muted">Loading exam…</p>
    </div>
  )

  if (loadError) return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="panel p-8 max-w-sm text-center">
        <p className="text-error mb-4">{loadError}</p>
        <a href="/workspace" className="btn-secondary">Back to examinations</a>
      </div>
    </div>
  )

  if (submitted) {
    const dateStr = submittedAt ? dateFormat.format(new Date(submittedAt)) : ''
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="panel p-10 max-w-sm text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-2">Attempt submitted</h1>
          {data?.exam && <p className="text-muted mb-1">{data.exam.title}</p>}
          {dateStr && <p className="text-muted text-sm mb-6">Submission recorded at {dateStr}.</p>}
          <a href="/workspace" className="btn-secondary">Back to examinations</a>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { exam } = data
  const q = questions[index]
  const answered = questions.filter(q =>
    q.kind === 'written' ? Boolean(q.written?.trim()) : q.kind === 'multiple' ? q.selected?.length > 0 : q.choice !== null
  )
  const mins = Math.floor(seconds / 60)
  const secs = String(seconds % 60).padStart(2, '0')
  const lowTime = seconds < 60

  function isAnswered(q) {
    return q.kind === 'written' ? Boolean(q.written?.trim()) : q.kind === 'multiple' ? q.selected?.length > 0 : q.choice !== null
  }

  return (
    <div className="attempt-shell min-h-screen bg-white">
      {/* Hidden video element for snapshot capture */}
      <video ref={proctor.videoRef} autoPlay muted playsInline className="hidden" aria-hidden="true" />
      {/* Proctor consent modal */}
      {showConsent && !submitted && !loadError && (
        <ProctorConsent
          onConsented={handleConsentGranted}
          onDenied={handleConsentDenied}
        />
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white/95 border-b border-line backdrop-blur-md">
        <div className="w-full max-w-[1160px] mx-auto px-6 min-h-[3.45rem] flex gap-4 justify-between items-center">
          <a href="/workspace" className="text-muted text-sm hover:text-ink">← Back</a>
          <span className="font-semibold text-sm truncate">{exam.title}</span>
          <div className={`text-center border border-line rounded-lg px-3 py-1.5 min-w-[7rem] ${lowTime ? 'text-error' : ''}`}>
            <div className="text-xs text-muted">Time remaining</div>
            <strong className="text-lg tabular-nums">{mins}:{secs}</strong>
            {isProctored.current && proctorReady && (
              <span className="text-xs text-muted ml-3">Camera active</span>
            )}
          </div>
        </div>
      </header>

      {isSandbox.current && (
        <div className="bg-[#fdecc8] text-[#6c5228] text-sm text-center py-2 px-4">
          Examiner sandbox · Practice answers are local to this preview
        </div>
      )}

      <main className="max-w-[1080px] mx-auto px-6 py-6">
        <h1 className="text-lg font-bold mb-1">{exam.title}</h1>
        <p className="text-muted text-sm mb-6">{exam.instructions || 'Answer the questions and submit before time expires.'}</p>

        <div className={`attempt-grid grid gap-4 ${layout === 'side' ? '' : 'stacked'} items-start`}>
          {/* Question */}
          <div className="attempt-question panel p-6" id="question" style={{ fontSize: textSize + 'px' }} inert={seconds === 0 ? '' : undefined}>
            {q && (
              <div>
                <div className="flex justify-between items-center text-sm text-muted mb-4">
                  <span>Question {index + 1} of {questions.length}</span>
                  <span>{q.marks} marks</span>
                </div>
                <fieldset className="border-0 p-0 m-0">
                  <legend className="font-semibold text-[1.2em] mb-4">{q.prompt}</legend>
                  {q.kind === 'written' ? (
                    <label className="form-label">
                      Written answer
                      <textarea
                        className="form-textarea"
                        rows={8}
                        maxLength={20000}
                        value={q.written || ''}
                        onChange={e => updateQuestion(q.id, { written: e.target.value })}
                      />
                    </label>
                  ) : (
                    <div className="space-y-2">
                      {q.choices.map((choice, i) => (
                        <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          (q.kind === 'multiple' ? q.selected?.includes(i) : q.choice === i)
                            ? 'border-ink bg-soft'
                            : 'border-line hover:bg-surface'
                        }`}>
                          <input
                            type={q.kind === 'multiple' ? 'checkbox' : 'radio'}
                            name="answer"
                            value={i}
                            checked={q.kind === 'multiple' ? q.selected?.includes(i) : q.choice === i}
                            onChange={() => {
                              if (q.kind === 'multiple') {
                                const sel = q.selected?.includes(i)
                                  ? q.selected.filter(x => x !== i)
                                  : [...(q.selected || []), i]
                                updateQuestion(q.id, { selected: sel })
                              } else {
                                updateQuestion(q.id, { choice: i })
                              }
                            }}
                          />
                          <span className="font-semibold text-muted w-5 flex-none">{'ABCD'[i]}</span>
                          <span>{choice}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
                <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
                  <div className="flex gap-3">
                    <button
                      className="btn-link text-sm"
                      disabled={!isAnswered(q)}
                      onClick={() => updateQuestion(q.id, q.kind === 'written' ? { written: '' } : q.kind === 'multiple' ? { selected: [] } : { choice: null })}
                    >
                      Clear answer
                    </button>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.flagged || false}
                        onChange={e => updateQuestion(q.id, { flagged: e.target.checked })}
                      />
                      Mark for review
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Previous</Button>
                    <Button variant="secondary" disabled={index === questions.length - 1} onClick={() => setIndex(i => i + 1)}>Next</Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="attempt-sidebar panel p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-2">Question navigator</h2>
              <p className="text-xs text-muted mb-2">{answered.length} of {questions.length} answered</p>
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => setIndex(i)}
                    className={`w-9 h-9 rounded text-xs font-semibold border transition-colors ${
                      i === index ? 'border-ink bg-ink text-white' :
                      isAnswered(q) && q.flagged ? 'border-[#6c5228] bg-[#fdecc8] text-[#6c5228]' :
                      isAnswered(q) ? 'border-[#336548] bg-[#edf3ed] text-[#336548]' :
                      q.flagged ? 'border-[#6c5228] bg-white text-[#6c5228]' :
                      'border-line bg-white text-muted'
                    }`}
                    aria-label={`Question ${i + 1}${isAnswered(q) ? ', answered' : ''}${q.flagged ? ', flagged' : ''}`}
                    aria-current={i === index ? 'step' : undefined}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-2 text-xs text-muted">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#edf3ed] border border-[#336548] inline-block"></span>Answered</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#fdecc8] border border-[#6c5228] inline-block"></span>Flagged</span>
              </div>
            </div>

            <div className="text-xs font-medium" role="status">{saveStatus}</div>
            {showRetry && (
              <Button variant="secondary" className="w-full text-xs" onClick={() => {
                questions.filter(q => unsaved.current.has(q.id)).forEach(q => enqueue(q))
              }}>
                Retry saving
              </Button>
            )}
            <Button variant="primary" className="w-full" onClick={() => setShowSubmitDialog(true)}>
              Review and submit
            </Button>

            {/* Announcements */}
            {announcements.length > 0 && (
              <div aria-live="polite" className="space-y-1">
                {announcements.map((a, i) => (
                  <p key={i} className="text-xs text-muted bg-surface rounded p-2">{a.message}</p>
                ))}
              </div>
            )}

            {/* Workspace prefs */}
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold mb-2">Workspace preferences</summary>
              <label className="form-label text-xs">
                Text size
                <select className="form-select text-xs" value={textSize} onChange={e => {
                  setTextSize(e.target.value)
                  writeLocal('preferences', { size: e.target.value, layout })
                }}>
                  <option value="16">Standard</option>
                  <option value="20">Large</option>
                  <option value="24">Extra large</option>
                </select>
              </label>
              <label className="form-label text-xs">
                Layout
                <select className="form-select text-xs" value={layout} onChange={e => {
                  setLayout(e.target.value)
                  writeLocal('preferences', { size: textSize, layout: e.target.value })
                }}>
                  <option value="side">Side navigator</option>
                  <option value="stack">Stacked navigator</option>
                </select>
              </label>
            </details>

            {/* Scratchpad */}
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold mb-2">Digital scratchpad</summary>
              <label className="form-label text-xs">
                Rough work
                <textarea
                  className="form-textarea text-xs"
                  rows={5}
                  maxLength={20000}
                  placeholder="Write your working here"
                  value={scratchpad}
                  onChange={e => {
                    setScratchpad(e.target.value)
                    writeLocal((isSandbox.current ? 'sandbox-' : '') + 'scratch-' + id, e.target.value)
                  }}
                />
              </label>
              <p className="text-xs text-muted">Saved on this browser for this exam.</p>
            </details>

            {/* Fullscreen */}
            <Button variant="secondary" className="w-full text-xs" onClick={() =>
              document.documentElement.requestFullscreen().catch(() => notify('Fullscreen unavailable.', true))
            }>
              Enter fullscreen
            </Button>
            <p className="text-xs text-muted">Tab changes, focus loss, paste, and fullscreen exits are recorded as review indicators.</p>
          </aside>
        </div>
      </main>

      {/* Submit dialog */}
      {showSubmitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="panel p-8 max-w-sm w-full mx-4">
            <h2 className="font-bold text-lg mb-3">Submit your attempt?</h2>
            <p className="text-muted text-sm mb-6">
              {answered.length} of {questions.length} answered.{' '}
              {questions.filter(q => q.flagged).length} marked for review.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowSubmitDialog(false)}>Keep working</Button>
              <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit attempt'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Notice message={notice.message} error={notice.error} />
    </div>
  )
}
