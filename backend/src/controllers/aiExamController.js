import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'examroom' },
  }
)

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL   = 'openai/gpt-oss-120b'

// Helper: verify JWT and return user (must be examiner or administrator)
async function verifyExaminer(req) {
  const match = req.headers.authorization?.match(/^Bearer (\S+)$/)
  if (!match) return null
  const { data, error } = await supabase.auth.getUser(match[1])
  if (error || !data?.user) return null

  const { data: prof } = await supabase
    .from('profiles')
    .select('id, role, active')
    .eq('id', data.user.id)
    .single()

  if (!prof || !prof.active || !['examiner', 'administrator'].includes(prof.role)) return null
  return { user: data.user, profile: prof }
}

// POST /api/ai-exam
// Body: { topic, numQuestions, difficulty, examTitle? }
export async function generate(req, res) {
  try {
    const auth = await verifyExaminer(req)
    if (!auth) return res.status(401).json({ error: 'Examiners only.' })

    const { topic, numQuestions, difficulty, examTitle } = req.body

    if (!topic || !numQuestions || !difficulty)
      return res.status(400).json({ error: 'topic, numQuestions, and difficulty are required.' })

    const num = parseInt(numQuestions, 10)
    if (isNaN(num) || num < 1 || num > 50)
      return res.status(400).json({ error: 'numQuestions must be between 1 and 50.' })

    const allowedDifficulties = ['easy', 'medium', 'hard', 'mixed']
    if (!allowedDifficulties.includes(difficulty.toLowerCase()))
      return res.status(400).json({ error: 'difficulty must be easy, medium, hard, or mixed.' })

    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) return res.status(503).json({ error: 'AI exam generation has not been configured.' })

    const systemPrompt = [
      'You are an expert exam question generator.',
      'Generate multiple-choice questions (MCQ) as a JSON array only — no markdown, no extra text.',
      'Each element must follow this exact shape:',
      '{ "prompt": "Question text", "choices": ["A", "B", "C", "D"], "correct": 0, "marks": 1, "difficulty": "medium" }',
      '"correct" is the 0-based index of the correct choice.',
      '"choices" must have exactly 4 items.',
      '"difficulty" must be one of: easy, medium, hard.',
      'Return ONLY the JSON array — no other content.',
    ].join(' ')

    const userPrompt = [
      `Generate ${num} MCQ questions`,
      examTitle ? `for the exam titled "${examTitle}"` : '',
      `on the topic: "${topic}".`,
      `Difficulty: ${difficulty}.`,
      'Return a JSON array only.',
    ].filter(Boolean).join(' ')

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
          temperature: 0.6,
          max_tokens:  4096,
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

    // Extract JSON array from response (strip any markdown fences if present)
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    let questions
    try {
      questions = JSON.parse(cleaned)
    } catch {
      return res.status(502).json({
        error: 'AI returned an invalid response. Please try again.',
        raw:   cleaned.slice(0, 500),
      })
    }

    if (!Array.isArray(questions)) {
      return res.status(502).json({
        error: 'AI response was not a JSON array. Please try again.',
      })
    }

    // Validate each question shape
    const validated = []
    for (const [i, q] of questions.entries()) {
      if (
        typeof q.prompt !== 'string' ||
        !Array.isArray(q.choices) || q.choices.length !== 4 ||
        typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3
      ) {
        return res.status(502).json({
          error: `AI returned an invalid question at index ${i}. Please try again.`,
        })
      }
      validated.push({
        prompt:     q.prompt,
        choices:    q.choices.map(String),
        correct:    Math.round(q.correct),
        marks:      typeof q.marks === 'number' && q.marks > 0 ? q.marks : 1,
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      })
    }

    return res.json(validated)
  } catch (e) {
    if (e.name === 'AbortError')
      return res.status(504).json({ error: 'AI generation timed out after 30 seconds.' })
    return res.status(500).json({ error: 'Internal server error.' })
  }
}
