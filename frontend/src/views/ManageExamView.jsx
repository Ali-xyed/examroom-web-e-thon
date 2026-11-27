import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { examRequest } from '../api.js'
import { PageHeader, Button, Breadcrumb, MetadataList, Panel, FormError } from '../components/ui.jsx'
import CandidateDirectory from '../components/CandidateDirectory.jsx'

export default function ManageExamView({ notify, profile }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enrollEmail, setEnrollEmail] = useState('')
  const [enrollError, setEnrollError] = useState('')
  const [enrollBusy, setEnrollBusy] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)

  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  function date(value) { return dateFormat.format(new Date(value)) }

  async function load() {
    setLoading(true)
    try {
      const result = await examRequest('manage', { examId: id })
      setData(result)
    } catch (err) {
      notify(err.message, true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function handleEnroll(e) {
    e.preventDefault()
    setEnrollError('')
    setEnrollBusy(true)
    try {
      await examRequest('enroll', { examId: id, email: enrollEmail })
      setEnrollEmail('')
      notify('Candidate enrolled.')
      load()
    } catch (err) {
      setEnrollError(err.message)
    } finally {
      setEnrollBusy(false)
    }
  }

  async function handlePublish() {
    setPublishBusy(true)
    try {
      const result = await examRequest('publish', { examId: id })
      setData(result)
      notify('Exam published.')
    } catch (err) {
      notify(err.message, true)
    } finally {
      setPublishBusy(false)
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>
  if (!data) return null

  const { exam, questions } = data
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)

  return (
    <div>
      <Breadcrumb back="Back to Examinations" backHref="/workspace" current={exam.title} />
      <PageHeader
        title={exam.title}
        description={exam.published ? 'Published examination' : 'Draft examination'}
        action={!exam.published ? (
          <Button variant="primary" onClick={handlePublish} disabled={publishBusy}>
            {publishBusy ? 'Publishing…' : 'Publish exam'}
          </Button>
        ) : null}
      />

      {/* Exam tools */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link to={`/workspace/monitor/${id}`} className="btn-secondary">Monitor and grade</Link>
        <Link to={`/workspace/analytics/${id}`} className="btn-secondary">Question analytics</Link>
        <Link to={`/workspace/sandbox/${id}`} className="btn-secondary">Preview as candidate</Link>
        <Link to={`/workspace/disputes/${id}`} className="btn-secondary">Disputes</Link>
        <Link to={`/workspace/fairness/${id}`} className="btn-secondary">Balanced papers</Link>
        <Link to={`/workspace/datesheet/${id}`} className="btn-secondary">Send datesheet</Link>
      </div>

      <div className="grid md:grid-cols-[1.65fr_1fr] gap-4 items-start">
        {/* Exam details */}
        <Panel>
          <h2>Exam details</h2>
          <MetadataList items={[
            ['Opens', date(exam.opens_at)],
            ['Closes', date(exam.closes_at)],
            ['Duration', `${exam.duration} min`],
            ['Total marks', totalMarks],
          ]} />
          {exam.instructions && (
            <p className="text-sm whitespace-pre-wrap mb-4">{exam.instructions}</p>
          )}
          <h3>Questions</h3>
          <ol className="list-decimal pl-5 space-y-1">
            {questions.map(q => (
              <li key={q.id} className="flex justify-between gap-4 py-1 border-b border-line last:border-0">
                <span className="overflow-wrap-anywhere">{q.prompt}</span>
                <span className="text-muted text-sm flex-none">{q.marks} marks</span>
              </li>
            ))}
          </ol>
        </Panel>

        {/* Candidates */}
        <Panel>
          <h2>Candidates</h2>
          <form onSubmit={handleEnroll} className="mb-4">
            <div className="flex items-end gap-2">
              <label className="form-label flex-1 mb-0">
                Candidate email
                <input
                  className="form-input"
                  type="email"
                  value={enrollEmail}
                  onChange={e => setEnrollEmail(e.target.value)}
                  required
                />
              </label>
              <Button variant="secondary" type="submit" disabled={enrollBusy}>
                {enrollBusy ? 'Enrolling…' : 'Enroll'}
              </Button>
            </div>
            <FormError>{enrollError}</FormError>
          </form>
          <CandidateDirectory examId={id} notify={notify} />
        </Panel>
      </div>
    </div>
  )
}
