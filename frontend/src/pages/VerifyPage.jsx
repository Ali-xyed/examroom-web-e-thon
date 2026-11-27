import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { verifyReport } from '../api.js'

export default function VerifyPage() {
  const [params] = useSearchParams()
  const code = params.get('verify')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) {
      setError('No verification code provided.')
      return
    }
    verifyReport(code)
      .then(setResult)
      .catch(err => setError(err.message))
  }, [code])

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 z-10 bg-white/95 border-b border-line backdrop-blur-md">
        <div className="w-full max-w-[1160px] mx-auto px-6 min-h-[3.45rem] flex gap-4 justify-between items-center">
          <a href="/" className="flex items-center gap-1 font-bold text-[1.1rem] tracking-tight text-ink no-underline">
            <img className="block w-14 h-7 object-contain" src="/reference/uc-logo.png" alt="" />
            UnCooked
          </a>
        </div>
      </header>
      <main className="max-w-[600px] mx-auto px-6 py-12">
        <div className="panel p-8">
          <h1 className="mb-4">Report verification</h1>
          {!result && !error && <p className="text-muted">Verifying…</p>}
          {error && <p className="text-error">{error}</p>}
          {result && (
            <>
              <p className={result.valid ? 'text-[#336548]' : 'text-error'}>
                {result.valid
                  ? 'This report is authentic and its issued result is still valid.'
                  : 'This code is invalid or the result has changed or been unpublished.'}
              </p>
              {result.valid && (
                <p className="text-muted mt-2">
                  Issued {new Date(result.issuedAt).toLocaleString()}
                </p>
              )}
            </>
          )}
          <a href="/" className="btn-secondary mt-6 inline-block">
            UnCooked home
          </a>
        </div>
      </main>
    </div>
  )
}
