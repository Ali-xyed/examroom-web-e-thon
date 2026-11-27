import { Router } from 'express'
import * as c from '../controllers/aiGradeController.js'

const router = Router()

router.post('/', c.grade)

export default router
