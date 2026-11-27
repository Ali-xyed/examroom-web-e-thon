import { useState, useEffect, useRef } from 'react'
import { examRequest } from '../api.js'
import { Panel, Button, PageHeader } from '../components/ui.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

// Markdown renderer — no external lib
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0

  function parseInline(str) {
    const parts = []
    let remaining = str
    let key = 0

    while (remaining.length > 0) {
      const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/s)
      const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/s)
      const italicMatch = remaining.match(/^(.*?)\*([^*]+?)\*(.*)$/s)
      const latexMatch = remaining.match(/^(.*?)\$([^$]+)\$(.*)$/s)

      let earliest = null
      if (codeMatch) {
        const idx = remaining.indexOf('`')
        if (!earliest || idx < earliest.idx) earliest = { type: 'code', idx, match: codeMatch }
      }
      if (boldMatch) {
        const idx = remaining.indexOf('**')
        if (!earliest || idx < earliest.idx) earliest = { type: 'bold', idx, match: boldMatch }
      }
      if (italicMatch && (!boldMatch || remaining.indexOf('*') < remaining.indexOf('**'))) {
        const idx = remaining.indexOf('*')
        if (!earliest || idx < earliest.idx) earliest = { type: 'italic', idx, match: italicMatch }
      }
      if (latexMatch) {
        const idx = remaining.indexOf('$')
        if (!earliest || idx < earliest.idx) earliest = { type: 'latex', idx, match: latexMatch }
      }

      if (!earliest) {
        if (remaining) parts.push(<span key={key++}>{remaining}</span>)
        break
      }

      const { type, match } = earliest
      const [, before, inner, after] = match
      if (before) parts.push(<span key={key++}>{before}</span>)
      if (type === 'code') {
        parts.push(<code key={key++} className="bg-soft px-1.5 py-0.5 rounded text-xs font-mono border border-line">{inner}</code>)
      } else if (type === 'bold') {
        parts.push(<strong key={key++} className="font-semibold text-ink">{inner}</strong>)
      } else if (type === 'italic') {
        parts.push(<em key={key++}>{inner}</em>)
      } else if (type === 'latex') {
        parts.push(<span key={key++} className="font-mono text-xs bg-soft px-1.5 py-0.5 rounded">{inner}</span>)
      }
      remaining = after
    }
    return parts
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <div key={`code-${i}`} className="my-2.5 rounded-lg border border-line bg-white overflow-hidden">
          {lang && (
            <div className="px-3 py-1 text-[11px] font-mono text-muted border-b border-line bg-surface">
              {lang}
            </div>
          )}
          <pre className="p-3 text-xs font-mono overflow-x-auto leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      )
      i++
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-line" />)
      i++
      continue
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = parseInline(headingMatch[2])
      const cls = level === 1 ? 'text-base font-bold mt-4 mb-2'
        : level === 2 ? 'text-sm font-bold mt-3.5 mb-1.5'
        : 'text-sm font-semibold mt-2.5 mb-1'
      elements.push(<div key={`h-${i}`} className={cls}>{content}</div>)
      i++
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={`bq-${i}`} className="border-l-2 border-ink pl-3 my-2 text-muted italic">
          {parseInline(trimmed.slice(2))}
        </blockquote>
      )
      i++
      continue
    }

    // Unordered list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listItems = []
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(<li key={i}>{parseInline(lines[i].trim().slice(2))}</li>)
        i++
      }
      elements.push(<ul key={`ul-${i}`} className="list-disc pl-5 my-1.5 space-y-1">{listItems}</ul>)
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(<li key={i}>{parseInline(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>)
        i++
      }
      elements.push(<ol key={`ol-${i}`} className="list-decimal pl-5 my-1.5 space-y-1">{listItems}</ol>)
      continue
    }

    // Empty line
    if (!trimmed) {
      i++
      continue
    }

    // Regular paragraph
    elements.push(<p key={`p-${i}`} className="mb-2 last:mb-0">{parseInline(line)}</p>)
    i++
  }

  return <>{elements}</>
}

function systemPrompt(exam) {
  return `You are a focused exam preparation assistant for students.
The student has an upcoming exam titled "${exam.title}".
The exam covers: "${exam.description || exam.title}".
Help the student understand concepts, explain topics clearly, provide examples, and answer questions.
If the student asks about a specific topic from the exam description, focus on that.
Provide code examples when relevant (in code blocks).
Be concise but thorough. Never give direct exam answers or cheat; focus on understanding.`
}

function greetingMessage(exam) {
  return `You have an upcoming exam: **${exam.title}**. The topics are **${exam.description || exam.title}**. Would you like to prepare? You can ask me to explain a topic, or just type what you want to study.`
}

export default function AIPrepView({ notify, dashboard }) {
  const [upcomingExams, setUpcomingExams] = useState([])
  const [selectedExam, setSelectedExam] = useState(null)
  const [messages, setMessages] = useState([]) // {role: 'user'|'assistant', content: string}
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // Load upcoming exams from dashboard or refetch
  useEffect(() => {
    const extractExams = (d) => {
      const list = d?.upcomingExams || d?.exams || []
      const now = d?.serverTime ? Date.parse(d.serverTime) : Date.now()
      return list.filter(e => !e.submitted_at && (!e.closes_at || Date.parse(e.closes_at) > now))
    }
    if (dashboard) {
      setUpcomingExams(extractExams(dashboard))
    } else {
      examRequest('dashboard')
        .then(data => setUpcomingExams(extractExams(data)))
        .catch(() => setUpcomingExams([]))
    }
  }, [dashboard])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function selectExam(exam) {
    setSelectedExam(exam)
    setAiError('')
    const greeting = { role: 'assistant', content: greetingMessage(exam) }
    setMessages([greeting])
    setInput('')
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading || !selectedExam) return
    setInput('')
    setAiError('')

    const userMsg = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoading(true)

    // Build history for Groq (exclude the initial greeting from messages)
    const history = nextMessages.map(m => ({ role: m.role, content: m.content }))

    try {
      const response = await fetch(`${API_URL}/api/ai-prep`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt(selectedExam) },
            ...history,
          ],
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error || err?.error?.message || 'AI request failed.')
      }

      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content || '(No response)'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setAiError(err.message || 'AI assist unavailable.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Study"
        description="Select an upcoming exam to review its topics with the study assistant."
      />
      <div className="border border-line rounded-2xl bg-white overflow-hidden flex" style={{ height: 'calc(100vh - 12rem)', minHeight: 460 }}>
        {/* Left panel: exam list */}
        <div
          style={{ width: 240, flexShrink: 0 }}
          className="border-r border-line bg-surface flex flex-col"
        >
          <div className="px-4 py-3 border-b border-line">
            <h2 className="font-semibold text-xs uppercase tracking-wider text-muted">Upcoming exams</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
            {upcomingExams.length === 0 ? (
              <p className="text-xs text-muted px-2 py-3">No upcoming exams found.</p>
            ) : (
              upcomingExams.map(exam => (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => selectExam(exam)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    selectedExam?.id === exam.id
                      ? 'bg-ink text-white'
                      : 'hover:bg-soft text-ink'
                  }`}
                >
                  <div className="font-medium truncate text-sm">{exam.title}</div>
                  {exam.description && (
                    <div className={`text-xs mt-0.5 truncate ${selectedExam?.id === exam.id ? 'text-white/75' : 'text-muted'}`}>
                      {exam.description}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel: chat */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {!selectedExam ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-muted text-sm text-center">Select an exam on the left to start your AI study session.</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="border-b border-line px-5 py-3 bg-white flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{selectedExam.title}</div>
                  {selectedExam.description && (
                    <div className="text-xs text-muted truncate">{selectedExam.description}</div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-ink text-white'
                          : 'bg-surface border border-line text-ink'
                      }`}
                    >
                      {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-surface border border-line rounded-2xl px-4 py-2 text-sm text-muted">
                      <span className="animate-pulse">•••</span>
                    </div>
                  </div>
                )}
                {aiError && (
                  <div className="flex justify-start">
                    <div className="bg-surface border border-line rounded-2xl px-4 py-2 text-sm text-error">
                      {aiError}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input bar */}
              <div className="border-t border-line bg-white px-4 py-3 flex gap-3 items-end">
                <textarea
                  ref={textareaRef}
                  className="form-textarea flex-1 resize-none text-sm"
                  rows={2}
                  placeholder="Ask a question about the exam topic… (Enter to send, Shift+Enter for newline)"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />
                <Button
                  variant="primary"
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="flex-none"
                >
                  {loading ? '…' : 'Send'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
