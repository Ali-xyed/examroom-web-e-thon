import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { examRequest } from '../api.js'
import { PageHeader, Panel, Button, FormError, Breadcrumb } from '../components/ui.jsx'

const LETTERS = ['A', 'B', 'C', 'D']

function QuestionFormFields({ q = {}, onChange }) {
  const kind = q.kind || 'single'

  return (
    <div className="space-y-3">
      <label className="form-label">
        Question text
        <textarea className="form-textarea" name="prompt" required maxLength={2000} rows={2}
          defaultValue={q.prompt || ''} onChange={onChange} />
      </label>
      {kind !== 'written' && (
        <fieldset className="border border-line rounded-md p-3">
          <legend className="font-semibold text-sm px-1">Answer choices</legend>
          <div className="grid grid-cols-2 gap-2">
            {LETTERS.map((letter, i) => (
              <label key={letter} className="form-label mb-0 text-sm">
                Choice {letter}
                <input className="form-input" name="choice" required maxLength={500} defaultValue={q.choices?.[i] || ''} />
              </label>
            ))}
          </div>
          <label className="form-label mt-2 text-sm">
            Correct choice
            <select className="form-select" name="correct" defaultValue={q.correct ?? 0}>
              {LETTERS.map((letter, i) => <option key={i} value={i}>{letter}</option>)}
            </select>
          </label>
        </fieldset>
      )}
      <label className="form-label text-sm">
        Marks
        <input className="form-input" name="marks" type="number" required min={1} max={100} defaultValue={q.marks || 1} />
      </label>
    </div>
  )
}

export default function CreateExamView({ notify, profile }) {
  const navigate = useNavigate()
  const [bank, setBank] = useState([])
  const [bankFilter, setBankFilter] = useState('')
  const [questions, setQuestions] = useState([{ _key: Date.now(), kind: 'single' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef(null)

  useEffect(() => {
    examRequest('bank').then(setBank).catch(() => setBank([]))
  }, [])

  function addQuestion() {
    setQuestions(prev => [...prev, { _key: Date.now(), kind: 'single' }])
  }

  function removeQuestion(key) {
    setQuestions(prev => prev.filter(q => q._key !== key))
  }

  function inputDate(value) {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const form = formRef.current
      const data = new FormData(form)
      const opensAt = new Date(data.get('opensAt'))
      const closesAt = new Date(data.get('closesAt'))
      if (closesAt <= opensAt) throw new Error('Closing time must be after opening time.')

      const qEls = [...form.querySelectorAll('[data-question]')]
      if (!qEls.length) throw new Error('Include at least one question.')

      const inlineQuestions = qEls.map(el => {
        const qData = new FormData(el)
        return {
          prompt: qData.get('prompt'),
          choices: qData.getAll('choice'),
          correct: Number(qData.get('correct') ?? 0),
          marks: Number(qData.get('marks')),
          kind: 'single',
        }
      })

      const result = await examRequest('create', {
        title: data.get('title'),
        instructions: data.get('instructions'),
        duration: Number(data.get('duration')),
        opensAt: opensAt.toISOString(),
        closesAt: closesAt.toISOString(),
        questions: inlineQuestions,
      })

      notify('Draft saved.')
      navigate(`/workspace/manage/${result.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const now = Date.now()
  const filteredBank = bank.filter(q =>
    (q.topic + ' ' + q.difficulty + ' ' + q.prompt).toLowerCase().includes(bankFilter.toLowerCase())
  )

  return (
    <div>
      <Breadcrumb back="Back to Examinations" backHref="/workspace" current="New examination" />
      <PageHeader title="New examination" description="Add the schedule, instructions, and questions." />

      <div className="grid md:grid-cols-[1.65fr_1fr] gap-4 items-start">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <Panel>
            <h2>Exam details</h2>
            <label className="form-label">Title <input className="form-input" name="title" required maxLength={150} /></label>
            <label className="form-label">Candidate instructions <textarea className="form-textarea" name="instructions" maxLength={5000} rows={3} /></label>
            <div className="grid grid-cols-3 gap-3">
              <label className="form-label">Opens at <input className="form-input" type="datetime-local" name="opensAt" required defaultValue={inputDate(new Date(now))} /></label>
              <label className="form-label">Closes at <input className="form-input" type="datetime-local" name="closesAt" required defaultValue={inputDate(new Date(now + 3600000))} /></label>
              <label className="form-label">Duration (min) <input className="form-input" name="duration" type="number" min={1} max={480} defaultValue={30} required /></label>
            </div>
          </Panel>

          <div className="space-y-3">
            {questions.map((q, i) => (
              <Panel key={q._key}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold">Question {i + 1}</h3>
                  {questions.length > 1 && (
                    <button type="button" className="btn-link text-sm text-error" onClick={() => removeQuestion(q._key)}>Remove</button>
                  )}
                </div>
                <div data-question>
                  <QuestionFormFields q={q} />
                </div>
              </Panel>
            ))}
          </div>

          <div className="flex justify-between items-center flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={addQuestion} disabled={questions.length >= 50}>
              Add question
            </Button>
            <div className="flex items-center gap-3">
              <FormError>{error}</FormError>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Button>
            </div>
          </div>
        </form>

        {/* Bank sidebar */}
        <Panel>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2>Question bank</h2>
              <p className="text-xs text-muted">Refer to bank for question ideas</p>
            </div>
            <span className="text-xs bg-soft text-muted rounded px-2 py-1">{bank.length}</span>
          </div>
          <label className="form-label mb-3 text-xs">
            Filter
            <input className="form-input text-xs" type="search" placeholder="Search topic, difficulty, text…"
              value={bankFilter} onChange={e => setBankFilter(e.target.value)} />
          </label>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredBank.length === 0 ? (
              <p className="text-muted text-xs">{bank.length ? 'No matches.' : 'No questions in bank yet.'}</p>
            ) : filteredBank.map(q => (
              <div key={q.id} className="border border-line rounded-md p-3 text-xs">
                <p className="font-semibold mb-1 overflow-wrap-anywhere">{q.prompt}</p>
                <span className="text-muted">{q.topic} · {q.difficulty} · {q.kind} · {q.marks}m</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
