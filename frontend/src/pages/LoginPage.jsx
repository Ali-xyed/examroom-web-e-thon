import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn } from '../api.js'
import Brand from '../components/Brand.jsx'
import '../styles/public-site.css'

const avatars = ['pile-1.webp', 'pile-2.webp', 'pile-3.webp', 'pile-4.webp']

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const data = new FormData(event.currentTarget)
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
    <main className="public-site" data-view="login">
      <section className="entry">
        <div className="login">
          <Link className="auth-back" to="/">← Back</Link>
          <div className="login-content">
            <Brand className="auth-brand" />
            <h1>Welcome back</h1>
            <p className="muted">Use the credentials provided for your role.</p>
            <form onSubmit={handleSubmit} aria-busy={loading}>
              <label htmlFor="email">Email address
                <input id="email" type="email" name="email" placeholder="you@institution.edu" autoComplete="username" required />
              </label>
              <div className="password-wrap">
                <label htmlFor="password">Password
                  <input id="password" type={showPassword ? 'text' : 'password'} name="password"
                    placeholder="••••••••" autoComplete="current-password" required />
                </label>
                <button type="button" id="password-toggle" className={showPassword ? 'revealed' : ''}
                  aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="password"
                  aria-pressed={showPassword} onClick={() => setShowPassword(visible => !visible)}>
                  <span aria-hidden="true" />
                </button>
              </div>
              <details className="auth-help">
                <summary>Forgot password?</summary>
                <p>Contact your exam administrator to reset your credentials.</p>
              </details>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary full" type="submit" disabled={loading}>
                <span aria-hidden="true">⇥</span> {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
        <aside className="intro" aria-labelledby="entry-title">
          <div className="intro-content">
            <span className="auth-badge">Secure Examination Management System</span>
            <div className="auth-hero">
              <div className="auth-avatars" aria-hidden="true">
                {avatars.map(name => <img key={name} src={`/reference/${name}`} alt="" width="76" height="76" />)}
              </div>
              <h2 id="entry-title"><span>Secure exams</span><span>for institutions</span><span>and candidates.</span></h2>
            </div>
            <p>Set up and publish assessments, take assigned exams, and submit answers with server-enforced timing.</p>
          </div>
        </aside>
      </section>
    </main>
  )
}
