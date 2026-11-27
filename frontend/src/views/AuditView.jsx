import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { examRequest } from '../api.js'
import { Panel, Breadcrumb, PageHeader } from '../components/ui.jsx'

export default function AuditView({ notify }) {
  const { id } = useParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const call = id
      ? examRequest('audit', { examId: id })
      : examRequest('admin_audit')
    call
      .then(setRows)
      .catch(err => notify(err.message, true))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div>
      <Breadcrumb
        back={id ? 'Back to Disputes' : 'Back to Overview'}
        backHref={id ? `/workspace/disputes/${id}` : '/workspace'}
        current="Audit log"
      />
      <PageHeader title="Immutable audit log" description="Append-only history. Latest 500 records." />
      {loading ? <p className="text-muted">Loading…</p> : (
        <Panel>
          {rows.length === 0 ? <p className="text-muted text-sm">No changes recorded yet.</p> : rows.map(row => (
            <details key={row.id} className="border-b border-line last:border-0 py-3">
              <summary className="cursor-pointer text-sm font-medium">
                {row.action}{row.exam_title ? ` · ${row.exam_title}` : ''} · {row.actor || 'System'} · {new Date(row.created_at).toLocaleString()} · #{row.id}
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-muted mb-1">Before</h4>
                  <pre className="text-xs bg-surface p-3 rounded whitespace-pre-wrap">{JSON.stringify(row.before_data, null, 2)}</pre>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted mb-1">After</h4>
                  <pre className="text-xs bg-surface p-3 rounded whitespace-pre-wrap">{JSON.stringify(row.after_data, null, 2)}</pre>
                </div>
              </div>
            </details>
          ))}
        </Panel>
      )}
    </div>
  )
}
