import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { hasSession } from './api.js'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import TakeExamPage from './pages/TakeExamPage.jsx'
import VerifyPage from './pages/VerifyPage.jsx'

function RequireAuth({ children }) {
  if (!hasSession()) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  useEffect(() => {
    // Listen for session-ended events triggered by api.js
    function onSessionEnded(e) {
      window.location.href = '/login'
    }
    window.addEventListener('session-ended', onSessionEnded)
    return () => window.removeEventListener('session-ended', onSessionEnded)
  }, [])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route
        path="/workspace/*"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/exam/:id"
        element={
          <RequireAuth>
            <TakeExamPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
