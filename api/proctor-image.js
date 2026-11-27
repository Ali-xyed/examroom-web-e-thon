import { getSignedUrl } from '../backend/src/controllers/proctorController.js'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Use GET.' })
  }
  // Extract captureId from query since Vercel serverless doesn't support path params directly
  // Frontend should call /api/proctor-image?captureId=xxx
  const captureId = req.query.captureId
  if (!captureId) return res.status(400).json({ error: 'captureId required' })
  req.params = { captureId }
  return getSignedUrl(req, res)
}
