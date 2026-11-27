import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { examRequest, signOut, hasSession } from '../api.js'
import { useNotice, Notice, Button } from '../components/ui.jsx'
import Brand from '../components/Brand.jsx'
import WorkspaceSidebar from '../components/WorkspaceSidebar.jsx'

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
import SettingsView from '../views/SettingsView.jsx'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { notice, notify } = useNotice()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [online, setOnline] = useState(() => navigator.onLine)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('uncooked-sidebar-collapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('uncooked-sidebar-collapsed', next ? '1' : '0')
      return next
    })
  }

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
        <p className="text-muted">Loading workspace…</p>
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

  return (
    <div className="workspace-shell min-h-screen flex bg-[#fafaf9]">
      <WorkspaceSidebar
        profile={profile}
        online={online}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header (hidden on lg+) */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 h-14 bg-white border-b border-line">
          <Brand to="/workspace" />
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            Menu
          </button>
        </header>

        <main className="workspace-main flex-1 w-full">
          <Routes>
            <Route index element={<HomeView dashboard={dashboard} onReload={loadDashboard} notify={notify} />} />
            <Route path="create" element={<CreateExamView notify={notify} profile={profile} />} />
            <Route path="manage/:id" element={<ManageExamView notify={notify} profile={profile} />} />
            <Route path="bank" element={<BankView notify={notify} profile={profile} />} />
            <Route path="users" element={<UsersView notify={notify} />} />
            <Route path="import" element={<ImportView notify={notify} profile={profile} />} />
            <Route path="settings" element={<SettingsView profile={profile} notify={notify} />} />
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
      </div>

      <Notice message={notice.message} error={notice.error} />
    </div>
  )
}
