import express from 'express'
import { sendDatesheet } from '../controllers/datesheetController.js'

const router = express.Router()

router.post('/', sendDatesheet)

export default router
