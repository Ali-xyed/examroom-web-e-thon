import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import datesheetRouter from './routes/datesheet.js'
import proctorRouter   from './routes/proctor.js'
import aiGradeRouter   from './routes/aiGrade.js'
import aiExamRouter    from './routes/aiExam.js'
import aiPrepRouter    from './routes/aiPrep.js'
import scoreMailRouter from './routes/scoreMail.js'

const app  = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

// Routes
app.use('/api/datesheet',  datesheetRouter)
app.use('/api/proctor',    proctorRouter)   // POST /upload, GET /image/:captureId, POST /review, POST /cleanup
app.use('/api/ai-grade',   aiGradeRouter)   // POST /
app.use('/api/ai-exam',    aiExamRouter)    // POST /
app.use('/api/ai-prep',    aiPrepRouter)    // POST /
app.use('/api/score-mail', scoreMailRouter) // POST /

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`ExamRoom backend running on http://localhost:${PORT}`)
})
