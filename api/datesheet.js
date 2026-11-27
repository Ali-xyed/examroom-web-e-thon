import { sendDatesheet } from '../backend/src/controllers/datesheetController.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }
  return sendDatesheet(req, res)
}
