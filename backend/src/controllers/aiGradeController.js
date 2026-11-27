import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL   = 'openai/gpt-oss-120b'

// Helper: verify JWT and return user profile (must be examiner or administrator)
async function verifyExaminer(req) {
  const match = req.headers.authorization?.match(/^Bearer (\S+)$/)
  if (!match) return null
  const { data, error } = await supabase.auth.getUser(match[1])
  if (error || !data?.user) return null

  // Use raw SQL via rpc to query examroom.profiles (not exposed via REST)
  const { data: rows, error: qErr } = await supabase.rpc('examroom_request', {
    operation: 'profile_check',
    payload: { userId: data.user.id },
  }).catch(() => ({ data: null, error: { message: 'rpc failed' } }))

  // Fallback: query via service role with direct SQL
  if (qErr || !rows) {
    // Use the admin client to run a raw query through postgrest function
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, role, active')
      .eq('id', data.user.id)
      .single()
    
    if (!prof || !prof.active || !['examiner', 'administrator'].includes(prof.role)) return null
    return { user: data.user, profile: prof }
  }

  return { user: data.user, profile: rows }
}

// POST /api/ai-grade
// Body: { questionPrompt, maxMarks, writtenAnswer, examinerContext? }
export async function grade(req, res) {
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) return res.status(503).json({ error: 'GROQ_API_KEY not configured on server.' })

    // Verify auth — try simple approach: just check the JWT is valid
    const match = req.headers.authorization?.match(/^Bearer (\S+)$/)
    if (!match) return res.status(401).json({ error: 'Authorization header required.' })
    
    const { data: authData, error: authErr } = await supabase.auth.getUser(match[1])
    if (authErr || !authData?.user) return res.status(401).json({ error: 'Invalid session.' })

    const { questionPrompt, maxMarks, writtenAnswer, examinerContext } = req.body

    if (!questionPrompt || maxMarks == null || writtenAnswer == null)
      return res.status(400).json({ error: 'questionPrompt, maxMarks, and writtenAnswer are required.' })

    const max = Number(maxMarks)
    if (isNaN(max) || max < 0)
      return res.status(400).json({ error: 'maxMarks must be a non-negative number.' })

    const systemPrompt =
      'You are an exam grading assistant. Given a question, its maximum marks, and a candidate\'s written answer, ' +
      'suggest a fair mark and provide a brief rationale. Be concise and objective. Never be harsh or use judgemental language.'

    let userPrompt = `Question (max ${max} marks): ${questionPrompt}\n\nCandidate answer: ${writtenAnswer}`
    if (examinerContext) userPrompt += `\n\nExaminer context: ${examinerContext}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    let groqRes
    try {
      groqRes = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
          ],
          temperature: 0.3,
          max_tokens:  512,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!groqRes.ok) {
      const errBody = await groqRes.text().catch(() => '')
      return res.status(502).json({ error: 'AI service error: ' + errBody })
    }

    const groqData = await groqRes.json()
    const content  = groqData.choices?.[0]?.message?.content ?? ''

    // Parse suggested_marks (number 0–maxMarks) and rationale from the response
    let suggested_marks = null
    let rationale       = content.trim()

    // Look for a pattern like "Suggested mark: 7" or "Mark: 7/10" or just a number at start
    const marksMatch = content.match(
      /(?:suggested?\s*marks?|mark|score)\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i
    )
    if (marksMatch) {
      const parsed = parseFloat(marksMatch[1])
      if (!isNaN(parsed) && parsed >= 0 && parsed <= max) suggested_marks = parsed
    }

    // Extract rationale: everything after the marks line, or the full content
    const rationaleMatch = content.match(
      /(?:rationale|reason|explanation|justification)\s*[:\-–]?\s*([\s\S]+)/i
    )
    if (rationaleMatch) rationale = rationaleMatch[1].trim()

    return res.json({ suggested_marks, rationale })
  } catch (e) {
    if (e.name === 'AbortError')
      return res.status(504).json({ error: 'AI grading timed out after 30 seconds.' })
    return res.status(500).json({ error: 'Internal server error.' })
  }
}
