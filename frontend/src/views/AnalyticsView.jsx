import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { examRequest } from '../api.js'
import { PageHeader, Panel, Breadcrumb } from '../components/ui.jsx'

export default function AnalyticsView({ notify }) {
  const { id } = useParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    examRequest('analytics', { examId: id })
      .then(setRows)
      .catch(err => notify(err.message, true))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div>
      <Breadcrumb back="Back to Manage exam" backHref={`/workspace/manage/${id}`} current="Question analytics" />
      <PageHeader title="Question analytics" description="Skipped and incorrect objective responses; average written marks." />
      {loading ? <p className="text-muted">Loading…</p> : rows.length === 0 ? (
        <Panel><p className="text-muted text-sm">No data yet.</p></Panel>
      ) : rows.map((q, i) => (
        <Panel key={i} className="mb-3">
          <h2 className="overflow-wrap-anywhere">{q.prompt}</h2>
          <p className="text-sm text-muted">
            {q.attempts} submitted attempts · {q.skipped} skipped · {q.incorrect} incorrect objective responses
          </p>
          {q.average_written_mark !== null && (
            <p className="text-sm text-muted">
              Average written mark {Number(q.average_written_mark).toFixed(2)} / {q.marks}
            </p>
          )}
        </Panel>
      ))}
    </div>
  )
}
