import { Router } from 'express'
import { chatPrep } from '../controllers/aiPrepController.js'

const router = Router()
router.post('/', chatPrep)
export default router
