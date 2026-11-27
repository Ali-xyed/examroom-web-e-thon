import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { examRequest } from '../api.js'
import { Panel, Breadcrumb, PageHeader } from '../components/ui.jsx'
import { downloadReport } from '../reportPdf.js'
import { Button } from '../components/ui.jsx'

export default function ResultView({ notify, profile }) {
  const { id } = useParams()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    examRequest('result', { examId: id })
      .then(setResult)
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
        <Panel className="max-w-lg">
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
      ) : (
        <p className="text-muted">No result available. Submit your attempt first.</p>
      )}
    </div>
  )
}
