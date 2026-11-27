import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { examRequest } from '../api.js'
import { PageHeader, Panel, Button, FormError, Breadcrumb } from '../components/ui.jsx'
import { downloadReport } from '../reportPdf.js'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function MonitorView({ notify, profile }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gradeTarget, setGradeTarget] = useState(null)
  const [publishBusy, setPublishBusy] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [liveEvents, setLiveEvents] = useState([])
  const [liveStatus, setLiveStatus] = useState('Connecting…')

  async function load() {
    setLoading(true)
    try {
      const result = await examRequest('monitor', { examId: id })
      setData(result)
    } catch (err) {
      notify(err.message, true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function handleGrade(e) {
    e.preventDefault()
    if (!gradeTarget) return
    const data = new FormData(e.currentTarget)
    try {
      await examRequest('grade', {
        examId: id,
        attemptId: gradeTarget.attemptId,
        questionId: gradeTarget.questionId,
        grade: Number(data.get('grade')),
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
    try {
      await examRequest('publish_results', { examId: id, published: !data?.resultsPublished })
      notify(data?.resultsPublished ? 'Results unpublished.' : 'Results published.')
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
      const report = await examRequest('monitor_report', { examId: id })
      await downloadReport({ ...report, examiner: true })
    } catch (err) {
      notify(err.message, true)
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>
  if (!data) return null

  const { exam, candidates, scores, resultsPublished, integrity } = data

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
              variant={resultsPublished ? 'secondary' : 'primary'}
              onClick={handlePublish}
              disabled={publishBusy}
            >
              {publishBusy ? '…' : resultsPublished ? 'Unpublish results' : 'Publish results'}
            </Button>
          </div>
        }
      />

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

      {/* Candidates roster */}
      <Panel className="mb-4">
        <h2>Submissions</h2>
        {!candidates?.length ? (
          <p className="text-muted text-sm">No enrolled candidates.</p>
        ) : (
          <div className="space-y-3">
            {candidates.map(c => (
              <div key={c.id} className="border-b border-line last:border-0 py-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <strong className="text-sm">{c.name}</strong>
                    <div className="text-xs text-muted">{c.email}</div>
                    {c.submittedAt && <div className="text-xs text-muted">Submitted {dateFormat.format(new Date(c.submittedAt))}</div>}
                  </div>
                  <div className="text-sm text-muted">
                    {c.submittedAt ? 'Submitted' : c.startedAt ? 'In progress' : 'Enrolled'}
                  </div>
                </div>
                {/* Written grade slots */}
                {c.writtenAnswers?.map(wa => (
                  <div key={wa.questionId} className="mt-2 pl-4 border-l-2 border-line">
                    <p className="text-xs font-semibold mb-1">{wa.prompt}</p>
                    <p className="text-xs text-muted whitespace-pre-wrap mb-2">{wa.written || '(no answer)'}</p>
                    {wa.grade !== null && wa.grade !== undefined ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">Grade: {wa.grade} / {wa.marks}</span>
                        <button className="btn-link text-xs" onClick={() => setGradeTarget({ attemptId: c.attemptId, questionId: wa.questionId, marks: wa.marks, currentGrade: wa.grade })}>Re-grade</button>
                      </div>
                    ) : (
                      <Button variant="secondary" className="text-xs" onClick={() => setGradeTarget({ attemptId: c.attemptId, questionId: wa.questionId, marks: wa.marks, currentGrade: null })}>
                        Grade (max {wa.marks})
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Grade dialog */}
      {gradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="panel p-6 max-w-sm w-full mx-4">
            <h2 className="font-bold text-lg mb-3">Grade written response</h2>
            <form onSubmit={handleGrade} className="space-y-3">
              <label className="form-label text-sm">
                Grade (0 – {gradeTarget.marks})
                <input className="form-input" name="grade" type="number" min={0} max={gradeTarget.marks} step={0.01} required defaultValue={gradeTarget.currentGrade ?? ''} />
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
