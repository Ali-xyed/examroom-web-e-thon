import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import datesheetRouter from './routes/datesheet.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

// Routes
app.use('/api/datesheet', datesheetRouter)

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`ExamRoom backend running on http://localhost:${PORT}`)
})
