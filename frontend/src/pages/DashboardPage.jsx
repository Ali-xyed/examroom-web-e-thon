import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom'
import { examRequest, signOut, hasSession } from '../api.js'
import { useNotice, Notice, Button } from '../components/ui.jsx'
import Brand from '../components/Brand.jsx'

// Sub-pages
import HomeView from '../views/HomeView.jsx'
import ManageExamView from '../views/ManageExamView.jsx'
import CreateExamView from '../views/CreateExamView.jsx'
import BankView from '../views/BankView.jsx'
import UsersView from '../views/UsersView.jsx'
import ImportView from '../views/ImportView.jsx'
import ResultView from '../views/ResultView.jsx'
import MonitorView from '../views/MonitorView.jsx'
import AnalyticsView from '../views/AnalyticsView.jsx'
import SandboxView from '../views/SandboxView.jsx'
import DisputesView from '../views/DisputesView.jsx'
import AuditView from '../views/AuditView.jsx'
import FairnessView from '../views/FairnessView.jsx'
import DatesheetView from '../views/DatesheetView.jsx'

const roles = { administrator: 'Administrator', examiner: 'Examiner', candidate: 'Candidate' }

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { notice, notify } = useNotice()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const info = await examRequest('dashboard')
      setDashboard(info)
    } catch (err) {
      if (!hasSession()) navigate('/login')
      else setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="panel p-8 max-w-sm text-center">
          <h1 className="text-xl mb-2">Could not open UnCooked</h1>
          <p className="text-muted text-sm mb-4">{loadError}</p>
          <Button variant="primary" onClick={loadDashboard}>Try again</Button>
          <Button variant="secondary" className="ml-2" onClick={() => { signOut(); navigate('/login') }}>
            Sign in with another account
          </Button>
        </div>
      </div>
    )
  }

  const { profile } = dashboard
  const currentPath = location.pathname

  const navItems =
    profile.role === 'examiner'
      ? [
          ['/workspace', 'Examinations'],
          ['/workspace/bank', 'Question bank'],
          ['/workspace/create', 'New examination'],
          ['/workspace/import', 'Bulk import'],
        ]
      : profile.role === 'administrator'
      ? [
          ['/workspace', 'Overview'],
          ['/workspace/users', 'Manage users'],
          ['/workspace/import', 'Bulk import'],
        ]
      : [['/workspace', 'My examinations']]

  return (
    <div className="workspace-shell min-h-screen bg-white">
      {/* Top Bar */}
      <header className="workspace-header sticky top-0 z-10 bg-white/95 border-b border-line backdrop-blur-md">
        <div className="workspace-header-inner flex gap-4 justify-between items-center">
          <Brand to="/workspace" />
          <div className="flex items-center gap-3">
            <div className="account-label text-right leading-tight">
              <div className="font-semibold text-[0.93rem]">{profile.name}</div>
              <div className="text-muted text-[0.85rem]">{roles[profile.role]}</div>
            </div>
            <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>
          </div>
        </div>
      </header>

      {/* Workspace nav bar */}
      <div className="workspace-bar">
        <div className="workspace-bar-inner">
          <nav className="workspace-nav" aria-label="Workspace navigation">
            {navItems.map(([href, label]) => {
              const active = currentPath === href || (href === '/workspace' && currentPath.startsWith('/workspace/') && !navItems.slice(1).some(([h]) => currentPath.startsWith(h)))
              return (
                <Link
                  key={href}
                  to={href}
                  className={`workspace-link ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="workspace-status" role="status">
            <span className={`conn-dot ${online ? 'online' : 'offline'}`} aria-hidden="true" />
            {online ? 'Connected' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="workspace-main">
        <Routes>
          <Route index element={<HomeView dashboard={dashboard} onReload={loadDashboard} notify={notify} />} />
          <Route path="create" element={<CreateExamView notify={notify} profile={profile} />} />
          <Route path="manage/:id" element={<ManageExamView notify={notify} profile={profile} />} />
          <Route path="bank" element={<BankView notify={notify} profile={profile} />} />
          <Route path="users" element={<UsersView notify={notify} />} />
          <Route path="import" element={<ImportView notify={notify} profile={profile} />} />
          <Route path="result/:id" element={<ResultView notify={notify} profile={profile} />} />
          <Route path="monitor/:id" element={<MonitorView notify={notify} profile={profile} />} />
          <Route path="analytics/:id" element={<AnalyticsView notify={notify} />} />
          <Route path="sandbox/:id" element={<SandboxView notify={notify} profile={profile} dashboard={dashboard} />} />
          <Route path="disputes/:id" element={<DisputesView notify={notify} profile={profile} />} />
          <Route path="audit/:id" element={<AuditView notify={notify} />} />
          <Route path="fairness/:id" element={<FairnessView notify={notify} />} />
          <Route path="datesheet/:id" element={<DatesheetView notify={notify} />} />
        </Routes>
      </main>

      <Notice message={notice.message} error={notice.error} />
    </div>
  )
}
