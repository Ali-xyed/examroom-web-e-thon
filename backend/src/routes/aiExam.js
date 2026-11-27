import { Router } from 'express'
import * as c from '../controllers/aiExamController.js'

const router = Router()

router.post('/', c.generate)

export default router
