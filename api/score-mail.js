import { sendScoreMail } from '../backend/src/controllers/scoreMailController.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }
  return sendScoreMail(req, res)
}
