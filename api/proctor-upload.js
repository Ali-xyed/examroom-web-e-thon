import { upload } from '../backend/src/controllers/proctorController.js'

export const config = { api: { bodyParser: false } }

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }

  // Check content type: JSON requests (missed captures) go straight through;
  // multipart requests (image uploads) also go straight through.
  // The controller's upload() handles both cases internally with its own multer.
  return upload(req, res)
}
