import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { examRequest, sessionToken } from '../api.js'
import { PageHeader, Panel, Button, FormError, Breadcrumb } from '../components/ui.jsx'
import { downloadReport } from '../reportPdf.js'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const API_URL = import.meta.env.VITE_API_URL || ''

export default function MonitorView({ notify, profile }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gradeTarget, setGradeTarget] = useState(null)
  const [gradeInput, setGradeInput] = useState('')
  const [aiSuggestBusy, setAiSuggestBusy] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [aiSuggestErr, setAiSuggestErr] = useState('')
  const [publishBusy, setPublishBusy] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [liveEvents, setLiveEvents] = useState([])
  const [liveStatus, setLiveStatus] = useState('Connecting…')

  async function load() {
    setLoading(true)
    try {
      const [result, manageData] = await Promise.all([
        examRequest('monitor', { examId: id }),
        examRequest('manage', { examId: id }).catch(() => null),
      ])
      setData({
        ...result,
        exam: result.exam || manageData?.exam || { id, title: 'Monitor and grade' },
      })
    } catch (err) {
      notify(err.message, true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  function openGradeDialog(attemptId, wa) {
    setGradeTarget({
      attemptId,
      questionId: wa.id || wa.questionId,
      marks: wa.marks,
      currentGrade: wa.grade,
      prompt: wa.prompt,
      written: wa.response ?? wa.written ?? '',
    })
    setGradeInput(wa.grade !== null && wa.grade !== undefined ? String(wa.grade) : '')
    setAiSuggestion(null)
    setAiSuggestErr('')
  }

  async function handleAiSuggest() {
    if (!gradeTarget) return
    setAiSuggestBusy(true)
    setAiSuggestErr('')
    setAiSuggestion(null)
    try {
      const token = await sessionToken()
      const res = await fetch(`${API_URL}/api/ai-grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          questionPrompt: gradeTarget.prompt,
          maxMarks: gradeTarget.marks,
          writtenAnswer: gradeTarget.written || '(no answer)',
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error || 'AI assist unavailable')
      setAiSuggestion(result)
    } catch (err) {
      setAiSuggestErr(err.message || 'AI assist unavailable')
    } finally {
      setAiSuggestBusy(false)
    }
  }

  async function handleGrade(e) {
    e.preventDefault()
    if (!gradeTarget) return
    try {
      await examRequest('grade', {
        examId: id,
        attemptId: gradeTarget.attemptId,
        questionId: gradeTarget.questionId,
        grade: Number(gradeInput),
      })
      notify('Grade saved.')
      setGradeTarget(null)
      await load()
    } catch (err) {
      notify(err.message, true)
    }
  }

  async function handlePublish() {
    setPublishBusy(true)
    const currentlyPublished = Boolean(data?.published ?? data?.resultsPublished)
    try {
      await examRequest('publish_results', { examId: id, published: !currentlyPublished })
      notify(currentlyPublished ? 'Results unpublished.' : 'Results published.')
      await load()
    } catch (err) {
      notify(err.message, true)
    } finally {
      setPublishBusy(false)
    }
  }

  async function sendAnnouncement() {
    if (!announcement.trim()) return
    setSendBusy(true)
    try {
      await examRequest('announce', { examId: id, message: announcement })
      setAnnouncement('')
      notify('Announcement sent.')
    } catch (err) {
      notify(err.message, true)
    } finally {
      setSendBusy(false)
    }
  }

  async function handleDownloadPdf() {
    try {
      const report = await examRequest('report', { examId: id })
      await downloadReport(report)
    } catch (err) {
      notify(err.message, true)
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>
  if (!data) return null

  const { exam, scores = [], integrity = [] } = data
  const attempts = data.attempts || data.candidates || []
  const isPublished = Boolean(data.published ?? data.resultsPublished)
  const avgScore = scores.length
    ? (scores.reduce((s, r) => s + Number(r.score || 0), 0) / scores.length).toFixed(2)
    : '—'

  return (
    <div>
      <Breadcrumb back="Back to Examinations" backHref="/workspace" current="Monitor and grade" />
      <PageHeader
        title={exam?.title || 'Monitor and grade'}
        description="Monitor progress, grade submissions, and publish results."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load}>Refresh</Button>
            <Button variant="secondary" onClick={handleDownloadPdf}>Download PDF</Button>
            <Button
              variant={isPublished ? 'secondary' : 'primary'}
              onClick={handlePublish}
              disabled={publishBusy}
            >
              {publishBusy ? '…' : isPublished ? 'Unpublish results' : 'Publish results'}
            </Button>
          </div>
        }
      />

      {/* Results summary */}
      <Panel className="mb-4">
        <h2>Results</h2>
        <p className="text-sm text-muted mb-3">
          {scores.length} submitted {scores.length === 1 ? 'attempt' : 'attempts'} · Average score {avgScore}
        </p>
        {scores.length > 0 && (
          <div className="space-y-1">
            {scores.map(s => (
              <div key={s.id} className="flex justify-between text-sm py-1 border-b border-line last:border-0">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted">
                  {s.score} / {s.total}
                  {Number(s.pending) > 0 ? ` · ${s.pending} written awaiting grading` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Announcement */}
      <Panel className="mb-4">
        <h2>Send announcement</h2>
        <div className="flex gap-2">
          <input
            className="form-input flex-1"
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            placeholder="Message to all active candidates…"
            maxLength={500}
          />
          <Button variant="secondary" onClick={sendAnnouncement} disabled={sendBusy || !announcement.trim()}>
            {sendBusy ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </Panel>

      {/* Attempts / Submissions */}
      <Panel className="mb-4">
        <h2>Submissions</h2>
        {!attempts.length ? (
          <p className="text-muted text-sm">No attempts recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {attempts.map(c => {
              const writtenList = c.written || c.writtenAnswers || []
              const attemptId = c.id || c.attemptId
              return (
                <div key={attemptId} className="border-b border-line last:border-0 py-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <strong className="text-sm">{c.name}</strong>
                      {c.email && <div className="text-xs text-muted">{c.email}</div>}
                      {c.submittedAt && (
                        <div className="text-xs text-muted">
                          Submitted {dateFormat.format(new Date(c.submittedAt))}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-muted text-right">
                      <div>{c.submittedAt ? 'Submitted' : 'In progress'}</div>
                      {c.answered != null && <div className="text-xs">{c.answered} answered</div>}
                    </div>
                  </div>
                  {c.incidents?.length > 0 && (
                    <div className="mt-2 text-xs text-muted">
                      Indicators: {c.incidents.map(inc => inc.event).join(', ')}
                    </div>
                  )}
                  {/* Written grade slots */}
                  {c.submittedAt && writtenList.map(wa => {
                    const qid = wa.id || wa.questionId
                    const answerText = wa.response ?? wa.written
                    return (
                      <div key={qid} className="mt-2 pl-4 border-l-2 border-line">
                        <p className="text-xs font-semibold mb-1">{wa.prompt}</p>
                        <p className="text-xs text-muted whitespace-pre-wrap mb-2">{answerText || '(no answer)'}</p>
                        {wa.grade !== null && wa.grade !== undefined ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">Grade: {wa.grade} / {wa.marks}</span>
                            {!isPublished && (
                              <button className="btn-link text-xs" onClick={() => openGradeDialog(attemptId, wa)}>Re-grade</button>
                            )}
                          </div>
                        ) : (
                          <Button variant="secondary" className="text-xs" disabled={isPublished} onClick={() => openGradeDialog(attemptId, wa)}>
                            Grade (max {wa.marks})
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Grade dialog */}
      {gradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="panel p-6 max-w-md w-full mx-4">
            <h2 className="font-bold text-lg mb-3">Grade written response</h2>
            <div className="mb-3">
              <Button type="button" variant="secondary" className="text-xs" onClick={handleAiSuggest} disabled={aiSuggestBusy}>
                {aiSuggestBusy ? 'Getting AI suggestion…' : 'AI Suggest'}
              </Button>
            </div>
            {aiSuggestErr && (
              <p className="text-xs text-error mb-3">{aiSuggestErr}</p>
            )}
            {aiSuggestion && (
              <div className="bg-surface border border-line rounded-lg p-3 mb-3 text-xs space-y-2">
                <div className="font-semibold">
                  Suggested: {aiSuggestion.suggested_marks !== null && aiSuggestion.suggested_marks !== undefined ? `${aiSuggestion.suggested_marks} / ${gradeTarget.marks} marks` : 'N/A'}
                </div>
                <p className="text-muted whitespace-pre-wrap">{aiSuggestion.rationale}</p>
                {aiSuggestion.suggested_marks !== null && aiSuggestion.suggested_marks !== undefined && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => setGradeInput(String(aiSuggestion.suggested_marks))}
                  >
                    Use this grade
                  </Button>
                )}
              </div>
            )}
            <form onSubmit={handleGrade} className="space-y-3">
              <label className="form-label text-sm">
                Grade (0 – {gradeTarget.marks})
                <input
                  className="form-input"
                  name="grade"
                  type="number"
                  min={0}
                  max={gradeTarget.marks}
                  step={0.01}
                  required
                  value={gradeInput}
                  onChange={e => setGradeInput(e.target.value)}
                />
              </label>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="secondary" onClick={() => setGradeTarget(null)}>Cancel</Button>
                <Button type="submit" variant="primary">Save grade</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
