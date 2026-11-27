import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { examRequest } from '../api.js'
import { PageHeader, Panel, Button, Breadcrumb } from '../components/ui.jsx'

export default function FairnessView({ notify }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [buckets, setBuckets] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    examRequest('paper_pool', { examId: id })
      .then(result => {
        setData(result)
        setBuckets(result.pool.map((b, i) => ({
          ...b,
          count: result.buckets.find(x => x.difficulty === b.difficulty && Number(x.marks) === Number(b.marks))?.count || 0,
        })))
      })
      .catch(err => notify(err.message, true))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = buckets.filter(b => b.count > 0).map(({ difficulty, marks, count }) => ({ difficulty, marks: Number(marks), count }))
      await examRequest('paper_settings', { examId: id, buckets: payload })
      notify('Balanced paper blueprint saved.')
    } catch (err) {
      notify(err.message, true)
    } finally {
      setSaving(false)
    }
  }

  const totalQ = buckets.reduce((s, b) => s + b.count, 0)
  const totalM = buckets.reduce((s, b) => s + b.count * b.marks, 0)

  if (loading) return <p className="text-muted">Loading…</p>

  return (
    <div>
      <Breadcrumb back="Back to Manage exam" backHref={`/workspace/manage/${id}`} current="Balanced papers" />
      <PageHeader title="Difficulty-balanced papers" description="Choose how many questions to draw from each difficulty and marks bucket." />
      <Panel>
        <p className="text-sm text-muted mb-4">Leave every count at zero to use the full question pool.</p>
        {data?.published && <p className="text-sm text-[#a62c32] mb-4">Published paper settings are locked.</p>}
        <form onSubmit={handleSave}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left pb-2 font-semibold text-muted">Difficulty</th>
                  <th className="text-left pb-2 font-semibold text-muted">Marks each</th>
                  <th className="text-left pb-2 font-semibold text-muted">Available</th>
                  <th className="text-left pb-2 font-semibold text-muted">Questions per paper</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="py-2">{b.difficulty}</td>
                    <td className="py-2">{b.marks}</td>
                    <td className="py-2">{b.available}</td>
                    <td className="py-2">
                      <input
                        type="number" min={0} max={b.available} value={b.count}
                        disabled={data?.published}
                        className="form-input w-24 text-sm"
                        onChange={e => setBuckets(prev => prev.map((item, idx) => idx === i ? { ...item, count: Number(e.target.value) } : item))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalQ > 0 && (
            <p className="text-sm text-muted mt-3">{totalQ} questions · {totalM} total marks per candidate</p>
          )}
          {!data?.published && (
            <Button type="submit" variant="primary" className="mt-4" disabled={saving}>
              {saving ? 'Saving…' : 'Save paper blueprint'}
            </Button>
          )}
        </form>
      </Panel>
    </div>
  )
}
