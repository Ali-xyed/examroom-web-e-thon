const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'openai/gpt-oss-120b'

export async function chatPrep(req, res) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured on server' })

    const { messages } = req.body || {}
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' })
    }

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'AI request failed.' })
    }
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message || 'AI prep error' })
  }
}
