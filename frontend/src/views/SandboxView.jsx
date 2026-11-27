import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { examRequest } from '../api.js'

// SandboxView loads sandbox attempt data and redirects to TakeExamPage in sandbox mode
export default function SandboxView({ notify, profile, dashboard }) {
  const { id } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    examRequest('sandbox', { examId: id })
      .then(data => {
        // Store sandbox flag and navigate to exam route
        navigate(`/exam/${id}`, { state: { sandboxData: data } })
      })
      .catch(err => {
        notify(err.message, true)
        navigate(`/workspace/manage/${id}`)
      })
  }, [id])

  return <p className="text-muted">Loading sandbox preview…</p>
}
