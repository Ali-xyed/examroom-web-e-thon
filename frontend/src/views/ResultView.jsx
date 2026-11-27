import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { examRequest } from '../api.js'
import { Panel, Breadcrumb, PageHeader, Button } from '../components/ui.jsx'
import { downloadReport } from '../reportPdf.js'

export default function ResultView({ notify, profile }) {
  const { id } = useParams()
  const [result, setResult] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      examRequest('result', { examId: id }),
      examRequest('result_comparison', { examId: id }).catch(() => null),
      examRequest('leaderboard', { examId: id }).catch(() => null),
    ])
      .then(([res, comp, lb]) => {
        setResult(res)
        setComparison(comp)
        setLeaderboard(lb)
      })
      .catch(err => notify(err.message, true))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDownload() {
    setDownloading(true)
    try {
      const report = await examRequest('report', { examId: id })
      await downloadReport(report)
    } catch (err) {
      notify(err.message, true)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>

  return (
    <div>
      <Breadcrumb back="Back to Examinations" backHref="/workspace" current="View result" />
      {result ? (
        <div className="max-w-lg space-y-4">
          <Panel>
            <h1 className="text-xl font-bold mb-4">{result.title}</h1>
            {result.published ? (
              <>
                <div className="bg-surface rounded-lg p-6 mb-4 text-center">
                  <div className="text-muted text-xs uppercase tracking-wider mb-1">Your score</div>
                  <div className="text-4xl font-black">{result.score} <span className="text-muted text-xl font-normal">/ {result.total}</span></div>
                  <div className="text-muted text-sm mt-1">
                    {Number(result.total) > 0 ? (Number(result.score) / Number(result.total) * 100).toFixed(1) + '%' : '—'}
                  </div>
                </div>
                <Button variant="primary" onClick={handleDownload} disabled={downloading}>
                  {downloading ? 'Generating PDF…' : 'Download PDF report'}
                </Button>
              </>
            ) : (
              <p className="text-muted">Results have not been published yet. Check back later.</p>
            )}
          </Panel>

          {/* Class comparison */}
          {result.published && comparison && (
            <Panel>
              <h2 className="mb-4">Class comparison</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted">Your score</span>
                  <span className="font-semibold">{comparison.score} / {comparison.total}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted">Class average</span>
                  <span className="font-semibold">{Number(comparison.classAvg).toFixed(1)} / {comparison.total}</span>
                </div>

                {/* Visual bar */}
                <div className="space-y-1.5 mt-3">
                  <div className="flex justify-between text-xs text-muted">
                    <span>Your score</span>
                    <span>{comparison.total > 0 ? (comparison.score / comparison.total * 100).toFixed(0) : 0}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-soft overflow-hidden">
                    <div
                      className="h-full rounded-full bg-ink transition-all"
                      style={{ width: `${comparison.total > 0 ? Math.min(100, comparison.score / comparison.total * 100) : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted mt-2">
                    <span>Class average</span>
                    <span>{comparison.total > 0 ? (comparison.classAvg / comparison.total * 100).toFixed(0) : 0}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-soft overflow-hidden">
                    <div
                      className="h-full rounded-full bg-soft border border-line transition-all"
                      style={{
                        width: `${comparison.total > 0 ? Math.min(100, comparison.classAvg / comparison.total * 100) : 0}%`,
                        background: 'repeating-linear-gradient(45deg, #d4d2ce 0px, #d4d2ce 2px, #efefed 2px, #efefed 8px)',
                      }}
                    />
                  </div>
                </div>

                {comparison.percentile != null && (
                  <p className="text-sm mt-3 border-t border-line pt-3">
                    You scored better than <strong>{Number(comparison.percentile).toFixed(0)}%</strong> of candidates.
                  </p>
                )}
                {comparison.rank != null && (
                  <p className="text-sm text-muted">
                    Rank: <strong className="text-ink">{comparison.rank}</strong> / {comparison.totalCandidates}
                  </p>
                )}
              </div>
            </Panel>
          )}

          {/* Leaderboard */}
          {result.published && leaderboard && leaderboard.length > 0 && (
            <Panel>
              <h2 className="mb-4">Leaderboard</h2>
              <div className="space-y-1">
                {leaderboard.slice(0, 10).map((entry, i) => {
                  const isMe = entry.isCurrentUser || entry.userId === profile?.id
                  const displayName = isMe ? (entry.name || 'You') : 'Candidate'
                  return (
                    <div
                      key={entry.userId || i}
                      className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm ${isMe ? 'bg-soft font-semibold' : ''}`}
                    >
                      <span className="text-muted w-5 text-right flex-none">{entry.rank ?? i + 1}</span>
                      <span className="flex-1 truncate">{isMe ? <strong>You ({entry.name || 'You'})</strong> : displayName}</span>
                      <span className="text-muted flex-none">
                        {entry.score} / {entry.total}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}
        </div>
      ) : (
        <p className="text-muted">No result available. Submit your attempt first.</p>
      )}
    </div>
  )
}
