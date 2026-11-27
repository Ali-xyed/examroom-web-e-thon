import { cleanup } from '../backend/src/controllers/proctorController.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }
  return cleanup(req, res)
}
