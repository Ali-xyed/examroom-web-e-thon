import { Router } from 'express'
import * as c from '../controllers/proctorController.js'

const router = Router()

router.post('/upload', c.upload)              // candidate uploads a frame or missed capture
router.get('/image/:captureId', c.signedUrl)  // examiner gets 60s signed URL
router.post('/review', c.review)              // examiner marks reviewed (+ storage delete) or escalated
router.post('/cleanup', c.cleanup)            // safety-net cleanup of >14d pending captures

export default router
