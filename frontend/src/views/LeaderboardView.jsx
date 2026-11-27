import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { examRequest, sessionToken } from '../api.js'
import { Panel, Breadcrumb, PageHeader, Button } from '../components/ui.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function LeaderboardView({ notify, profile }) {
  const { id } = useParams()
  const [leaderboard, setLeaderboard] = useState(null)
  const [examTitle, setExamTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [mailBusy, setMailBusy] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      examRequest('leaderboard', { examId: id }),
      examRequest('manage', { examId: id }).catch(() => null),
    ])
      .then(([lb, mgmt]) => {
        setLeaderboard(lb || [])
        if (mgmt?.exam?.title) setExamTitle(mgmt.exam.title)
      })
      .catch(err => notify(err.message, true))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSendMail() {
    setMailBusy(true)
    try {
      const token = await sessionToken()
      const res = await fetch(`${API_URL}/api/score-mail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ examId: id }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error || 'Could not send score reports.')
      notify(`Score reports sent: ${result.sent ?? 0} delivered, ${result.failed ?? 0} failed.`)
    } catch (err) {
      notify(err.message, true)
    } finally {
      setMailBusy(false)
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>

  return (
    <div>
      <Breadcrumb
        back={examTitle || 'Back to exam'}
        backHref={`/workspace/manage/${id}`}
        current="Leaderboard"
      />
      <PageHeader
        title="Leaderboard"
        description={examTitle ? `Rankings for "${examTitle}"` : 'Candidate rankings and scores'}
        action={
          <Button variant="secondary" onClick={handleSendMail} disabled={mailBusy}>
            {mailBusy ? 'Sending…' : 'Send score report by email'}
          </Button>
        }
      />

      <Panel>
        {!leaderboard || leaderboard.length === 0 ? (
          <p className="text-muted text-sm">No results available yet. Publish results to populate the leaderboard.</p>
        ) : (
          <div>
            {/* Header row */}
            <div className="flex items-center gap-3 py-2 px-3 text-xs text-muted uppercase tracking-wider font-semibold border-b border-line mb-1">
              <span className="w-8 text-right flex-none">#</span>
              <span className="flex-1">Candidate</span>
              <span className="w-20 text-right flex-none">Score</span>
              <span className="w-16 text-right flex-none">Pct</span>
              <span className="w-20 text-right flex-none">Percentile</span>
            </div>
            <div className="space-y-0.5">
              {leaderboard.map((entry, i) => {
                const pct = entry.total > 0 ? (entry.score / entry.total * 100).toFixed(1) : '—'
                const percentile = entry.percentile != null ? `${Number(entry.percentile).toFixed(0)}%` : '—'
                const rank = entry.rank ?? i + 1
                return (
                  <div
                    key={entry.userId || i}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm hover:bg-surface transition-colors"
                  >
                    <span className="w-8 text-right flex-none font-semibold text-muted">{rank}</span>
                    <span className="flex-1 truncate font-medium">{entry.name || 'Candidate'}</span>
                    <span className="w-20 text-right flex-none">{entry.score} / {entry.total}</span>
                    <span className="w-16 text-right flex-none text-muted">{pct}%</span>
                    <span className="w-20 text-right flex-none text-muted">{percentile}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
