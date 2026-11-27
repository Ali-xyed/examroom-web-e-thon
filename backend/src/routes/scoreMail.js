import { Router } from 'express'
import { sendScoreReports } from '../controllers/scoreMailController.js'

const router = Router()
router.post('/', sendScoreReports)

export default router
