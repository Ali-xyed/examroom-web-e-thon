import { upload } from '../backend/src/controllers/proctorController.js'
import multer from 'multer'

const storage = multer.memoryStorage()
const multerMiddleware = multer({ storage, limits: { fileSize: 150 * 1024 } })

export const config = { api: { bodyParser: false } }

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }
  multerMiddleware.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    return upload(req, res)
  })
}
