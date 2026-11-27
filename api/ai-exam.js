import { generateExam } from '../backend/src/controllers/aiExamController.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }
  return generateExam(req, res)
}
