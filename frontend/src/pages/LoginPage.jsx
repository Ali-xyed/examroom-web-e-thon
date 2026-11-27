import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../api.js'
import { Button, FormError, Logo } from '../components/ui.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const data = new FormData(e.currentTarget)
    try {
      await signIn(data.get('email').trim(), data.get('password'))
      navigate('/workspace')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white/95 border-b border-line backdrop-blur-md">
        <div className="w-full max-w-[1160px] mx-auto px-6 min-h-[3.45rem] flex gap-4 justify-between items-center">
          <a href="/" className="flex items-center gap-1 font-bold text-[1.1rem] tracking-tight text-ink no-underline">
            <img className="block w-14 h-7 object-contain" src="/reference/uc-logo.png" alt="" />
            UnCooked
          </a>
          <a href="/" className="btn-secondary">← Back</a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="panel p-8">
            <div className="flex items-center gap-1 font-bold text-[1.1rem] tracking-tight text-ink mb-6">
              <img className="block w-14 h-7 object-contain" src="/reference/uc-logo.png" alt="" />
              UnCooked
            </div>
            <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
            <p className="text-muted text-sm mb-6">Use the credentials provided for your role.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="form-label">
                Email address
                <input
                  className="form-input"
                  type="email"
                  name="email"
                  placeholder="you@institution.edu"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="form-label">
                Password
                <div className="relative">
                  <input
                    className="form-input pr-12"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <details className="text-sm text-muted">
                <summary className="cursor-pointer">Forgot password?</summary>
                <p className="mt-1">Contact your exam administrator to reset your credentials.</p>
              </details>

              <FormError>{error}</FormError>

              <Button variant="primary" className="w-full" disabled={loading} type="submit">
                {loading ? 'Signing in…' : '⇥ Sign in'}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
