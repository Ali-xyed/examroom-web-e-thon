import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { examRequest, sessionToken } from '../api.js'
import { PageHeader, Panel, Button, FormError, Breadcrumb } from '../components/ui.jsx'

const LETTERS = ['A', 'B', 'C', 'D']

function makeBlankQuestion() {
  return {
    _key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    bankId: null,
    kind: 'single',
    prompt: '',
    choices: ['', '', '', ''],
    correct: 0,
    marks: 1,
  }
}

function inputDate(value) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function CreateExamView({ notify }) {
  const navigate = useNavigate()
  const [bank, setBank] = useState([])
  const [bankFilter, setBankFilter] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [opensAt, setOpensAt] = useState(() => inputDate(new Date()))
  const [closesAt, setClosesAt] = useState(() => inputDate(new Date(Date.now() + 3600000)))
  const [duration, setDuration] = useState(30)
  const [proctoring, setProctoring] = useState('off')
  const [questions, setQuestions] = useState(() => [makeBlankQuestion()])
  const [dropActive, setDropActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // AI generator state
  const [aiTopic, setAiTopic] = useState('')
  const [aiNum, setAiNum] = useState(5)
  const [aiDifficulty, setAiDifficulty] = useState('medium')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    examRequest('bank').then(setBank).catch(() => setBank([]))
  }, [])

  const addedBankIds = new Set(questions.map(q => q.bankId).filter(Boolean))

  function addBlankQuestion() {
    if (questions.length >= 50) return
    setQuestions(prev => [...prev, makeBlankQuestion()])
  }

  function removeQuestion(key) {
    setQuestions(prev => (prev.length <= 1 ? prev : prev.filter(q => q._key !== key)))
  }

  function updateQuestion(key, patch) {
    setQuestions(prev => prev.map(q => (q._key === key ? { ...q, ...patch } : q)))
  }

  function updateChoice(key, idx, val) {
    setQuestions(prev =>
      prev.map(q => {
        if (q._key !== key) return q
        const next = [...q.choices]
        next[idx] = val
        return { ...q, choices: next }
      })
    )
  }

  function addFromBank(bankItem) {
    if (!bankItem || addedBankIds.has(bankItem.id)) return
    if (questions.length >= 50) {
      notify('An examination can have at most 50 questions.', true)
      return
    }
    const newCard = {
      _key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bankId: bankItem.id,
      kind: bankItem.kind || 'single',
      prompt: bankItem.prompt || '',
      choices: Array.isArray(bankItem.choices) && bankItem.choices.length === 4 ? [...bankItem.choices] : ['', '', '', ''],
      correct: Number(bankItem.correct ?? 0),
      marks: Number(bankItem.marks || 1),
      topic: bankItem.topic,
      difficulty: bankItem.difficulty,
    }
    setQuestions(prev => {
      const first = prev[0]
      const firstIsBlank =
        prev.length === 1 &&
        !first.bankId &&
        !first.prompt.trim() &&
        first.choices.every(c => !c.trim())
      return firstIsBlank ? [newCard] : [...prev, newCard]
    })
    notify('Added question from Question Bank.')
  }

  function handleDrop(e) {
    e.preventDefault()
    setDropActive(false)
    const bankId = e.dataTransfer.getData('text/plain')
    if (!bankId) return
    const item = bank.find(q => q.id === bankId)
    if (item) addFromBank(item)
  }

  async function handleAiGenerate() {
    if (!aiTopic.trim()) { setAiError('Please enter a topic.'); return }
    setAiError('')
    setAiLoading(true)
    try {
      const token = await sessionToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/ai-exam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          numQuestions: Number(aiNum),
          difficulty: aiDifficulty,
          examTitle: title.trim() || aiTopic.trim(),
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error || err?.message || 'AI generation failed.')
      }
      const data = await response.json()
      const generated = Array.isArray(data) ? data : data.questions || []
      if (!generated.length) throw new Error('No questions were returned.')

      const newQuestions = generated.map(q => ({
        _key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        bankId: null,
        kind: 'single',
        prompt: q.prompt || q.question || '',
        choices: Array.isArray(q.choices) && q.choices.length === 4 ? q.choices : ['', '', '', ''],
        correct: Number(q.correct ?? q.correctIndex ?? 0),
        marks: Number(q.marks || 1),
      }))

      setQuestions(prev => {
        const first = prev[0]
        const firstIsBlank =
          prev.length === 1 &&
          !first.bankId &&
          !first.prompt.trim() &&
          first.choices.every(c => !c.trim())
        return firstIsBlank ? newQuestions : [...prev, ...newQuestions]
      })
      notify(`Added ${newQuestions.length} AI-generated questions.`)
    } catch (err) {
      setAiError(err.message || 'AI generation failed.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const opens = new Date(opensAt)
      const closes = new Date(closesAt)
      if (closes <= opens) throw new Error('Closing time must be after opening time.')

      const inlineQuestions = questions.filter(q => q.kind === 'single')
      const bankAssigned = questions.filter(q => q.kind !== 'single' && q.bankId)

      if (inlineQuestions.length === 0) {
        throw new Error('Include at least one single-answer question before saving the draft.')
      }

      const result = await examRequest('create', {
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        duration: Number(duration),
        opensAt: opens.toISOString(),
        closesAt: closes.toISOString(),
        proctoring_mode: proctoring,
        questions: inlineQuestions.map(q => ({
          prompt: q.prompt.trim(),
          choices: q.choices.map(c => c.trim()),
          correct: Number(q.correct),
          marks: Number(q.marks),
        })),
      })

      for (const q of bankAssigned) {
        await examRequest('assign', { examId: result.id, questionId: q.bankId })
      }

      notify('Draft saved.')
      navigate(`/workspace/manage/${result.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredBank = bank.filter(q =>
    (q.topic + ' ' + q.difficulty + ' ' + q.prompt).toLowerCase().includes(bankFilter.toLowerCase())
  )

  return (
    <div>
      <Breadcrumb back="Back to Examinations" backHref="/workspace" current="New examination" />
      <PageHeader
        title="New examination"
        description="Set the schedule and build questions manually or drag and drop from your Question Bank."
      />

      <div className="create-grid grid gap-5 items-start">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Panel>
            <h2 className="mb-3">Exam details</h2>
            <label className="form-label">
              Title
              <input className="form-input" required maxLength={150} value={title} onChange={e => setTitle(e.target.value)} />
            </label>
            <label className="form-label">
              Description
              <input
                className="form-input"
                maxLength={500}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Kubernetes and GitHub Actions"
              />
            </label>
            <label className="form-label">
              Candidate instructions
              <textarea className="form-textarea" maxLength={5000} rows={3} value={instructions} onChange={e => setInstructions(e.target.value)} />
            </label>
            <div className="schedule-fields grid gap-3">
              <label className="form-label">
                Opens at
                <input className="form-input" type="datetime-local" required value={opensAt} onChange={e => setOpensAt(e.target.value)} />
              </label>
              <label className="form-label">
                Closes at
                <input className="form-input" type="datetime-local" required value={closesAt} onChange={e => setClosesAt(e.target.value)} />
              </label>
              <label className="form-label">
                Duration (min)
                <input className="form-input" type="number" min={1} max={480} required value={duration} onChange={e => setDuration(e.target.value)} />
              </label>
              <label className="form-label">
                Proctoring
                <select className="form-select" value={proctoring} onChange={e => setProctoring(e.target.value)}>
                  <option value="off">Off</option>
                  <option value="snapshots">Snapshots</option>
                </select>
              </label>
            </div>
          </Panel>

          <p className="text-xs text-muted">
            Drag questions from the Question Bank panel on the right and drop them below, or click Add.
          </p>

          <div
            className={`space-y-3 rounded-xl transition-all ${dropActive ? 'ring-2 ring-dashed ring-ink bg-surface p-2' : ''}`}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropActive(true) }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropActive(false) }}
            onDrop={handleDrop}
          >
            {questions.map((q, i) => (
              <Panel key={q._key} className={q.bankId ? 'border-dashed bg-surface/60' : ''}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Question {i + 1}</h3>
                    {q.bankId && (
                      <span className="text-xs bg-soft text-ink rounded-full px-2.5 py-0.5 font-medium">
                        From bank · {q.kind}
                      </span>
                    )}
                  </div>
                  {questions.length > 1 && (
                    <button type="button" className="btn-link text-sm text-error" onClick={() => removeQuestion(q._key)}>
                      Remove
                    </button>
                  )}
                </div>

                {q.kind !== 'single' && q.bankId ? (
                  <div>
                    <p className="font-medium text-sm mb-1">{q.prompt}</p>
                    <p className="text-xs text-muted">{q.topic} · {q.difficulty} · {q.marks} marks</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="form-label">
                      Question text
                      <textarea
                        className="form-textarea"
                        required
                        maxLength={2000}
                        rows={2}
                        value={q.prompt}
                        onChange={e => updateQuestion(q._key, { prompt: e.target.value })}
                      />
                    </label>
                    <fieldset className="border border-line rounded-md p-3">
                      <legend className="font-semibold text-sm px-1">Answer choices</legend>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                        {LETTERS.map((letter, idx) => (
                          <label key={letter} className="form-label mb-0 text-sm">
                            Choice {letter}
                            <input
                              className="form-input"
                              required
                              maxLength={500}
                              value={q.choices[idx]}
                              onChange={e => updateChoice(q._key, idx, e.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="form-label mb-0 text-sm">
                          Correct choice
                          <select
                            className="form-select"
                            value={q.correct}
                            onChange={e => updateQuestion(q._key, { correct: Number(e.target.value) })}
                          >
                            {LETTERS.map((letter, idx) => <option key={idx} value={idx}>{letter}</option>)}
                          </select>
                        </label>
                        <label className="form-label mb-0 text-sm">
                          Marks
                          <input
                            className="form-input"
                            type="number"
                            required
                            min={1}
                            max={100}
                            value={q.marks}
                            onChange={e => updateQuestion(q._key, { marks: e.target.value })}
                          />
                        </label>
                      </div>
                    </fieldset>
                  </div>
                )}
              </Panel>
            ))}
          </div>

          <div className="flex justify-between items-center flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={addBlankQuestion} disabled={questions.length >= 50}>
              ＋ Add blank question
            </Button>
            <div className="flex items-center gap-3">
              <FormError>{error}</FormError>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Button>
            </div>
          </div>
        </form>

        {/* Right column: Question bank + AI generator */}
        <div className="space-y-4">
          {/* Sticky Draggable Question Bank Sidebar */}
          <Panel className="bank-sidebar sticky top-6">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2>Question bank</h2>
                <p className="text-xs text-muted">Drag &amp; drop or click Add</p>
              </div>
              <span className="text-xs bg-soft text-muted rounded-full px-2.5 py-1 font-semibold">{bank.length}</span>
            </div>
            <label className="form-label mb-3 text-xs">
              Filter questions
              <input
                className="form-input text-xs"
                type="search"
                placeholder="Search topic, difficulty, text…"
                value={bankFilter}
                onChange={e => setBankFilter(e.target.value)}
              />
            </label>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredBank.length === 0 ? (
                <p className="text-muted text-xs">
                  {bank.length ? 'No matches.' : <>No questions in bank yet. <Link to="/workspace/bank" className="underline">Create one</Link>.</>}
                </p>
              ) : (
                filteredBank.map(q => {
                  const isAdded = addedBankIds.has(q.id)
                  return (
                    <div
                      key={q.id}
                      draggable={!isAdded}
                      onDragStart={e => {
                        if (isAdded) { e.preventDefault(); return }
                        e.dataTransfer.setData('text/plain', q.id)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      className={`border rounded-lg p-3 text-xs flex items-start gap-2 transition-opacity ${
                        isAdded
                          ? 'border-line bg-surface opacity-55 cursor-not-allowed'
                          : 'border-line bg-white cursor-grab hover:border-ink/40 hover:shadow-sm'
                      }`}
                    >
                      <span className="text-muted select-none pt-0.5" aria-hidden="true">⋮⋮</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold mb-1 overflow-wrap-anywhere">{q.prompt}</p>
                        <span className="text-muted">{q.topic} · {q.difficulty} · {q.kind} · {q.marks}m</span>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isAdded}
                        onClick={() => addFromBank(q)}
                        className="text-xs px-2.5 py-1 min-h-0 flex-none"
                      >
                        {isAdded ? 'Added ✓' : '＋ Add'}
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </Panel>

          {/* AI Exam Generator */}
          <Panel>
            <h2 className="mb-3">AI-generate questions</h2>
            <div className="space-y-3">
              <label className="form-label text-sm">
                Topic
                <input
                  className="form-input"
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder="e.g. Docker networking, React hooks"
                  maxLength={200}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="form-label text-sm mb-0">
                  Num questions
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={20}
                    value={aiNum}
                    onChange={e => setAiNum(e.target.value)}
                  />
                </label>
                <label className="form-label text-sm mb-0">
                  Difficulty
                  <select className="form-select" value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>
              {aiError && <p className="text-error text-xs">{aiError}</p>}
              <Button
                type="button"
                variant="secondary"
                onClick={handleAiGenerate}
                disabled={aiLoading || !aiTopic.trim()}
              >
                {aiLoading ? 'Generating…' : 'Generate'}
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
