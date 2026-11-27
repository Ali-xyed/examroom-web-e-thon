import { useState, useEffect, useRef } from 'react'
import { examRequest } from '../api.js'
import { PageHeader, Panel, Button, FormError, Breadcrumb } from '../components/ui.jsx'

const LETTERS = ['A', 'B', 'C', 'D']
const KINDS = [['single', 'Single-answer MCQ'], ['multiple', 'Multiple-select MCQ'], ['written', 'Written response']]
const DIFFICULTIES = ['easy', 'medium', 'hard']

function BankQuestionForm({ q = {}, onSave, onCancel, busy, submitLabel = 'Save question' }) {
  const [prompt, setPrompt] = useState(q.prompt || '')
  const [kind, setKind] = useState(q.kind || 'single')
  const [topic, setTopic] = useState(q.topic || 'General')
  const [difficulty, setDifficulty] = useState(q.difficulty || 'easy')
  const [marks, setMarks] = useState(q.marks ?? 1)
  const [choices, setChoices] = useState(() =>
    Array.isArray(q.choices) && q.choices.length === 4 && q.kind !== 'written'
      ? [...q.choices]
      : ['', '', '', '']
  )
  const [correct, setCorrect] = useState(q.correct ?? 0)
  const [correctSet, setCorrectSet] = useState(() => Array.isArray(q.correct_set) ? [...q.correct_set] : [])
  const [error, setError] = useState('')

  function toggleCorrectSet(index) {
    setCorrectSet(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (kind === 'multiple' && correctSet.length === 0) {
      setError('Select at least one correct answer.')
      return
    }
    const payload = {
      id: q.id,
      prompt: prompt.trim(),
      kind,
      topic: topic.trim() || 'General',
      difficulty,
      marks: Number(marks),
      choices: kind === 'written' ? ['Unused 0', 'Unused 1', 'Unused 2', 'Unused 3'] : choices.map(c => c.trim()),
      correct: kind === 'single' ? Number(correct) : 0,
      correctSet: kind === 'multiple' ? correctSet : [],
    }
    try {
      await onSave(payload)
      if (!q.id) {
        setPrompt('')
        setChoices(['', '', '', ''])
        setCorrect(0)
        setCorrectSet([])
        setMarks(1)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="form-label">
        Question
        <textarea className="form-textarea" required maxLength={2000} value={prompt} onChange={e => setPrompt(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="form-label text-sm">
          Type
          <select className="form-select" value={kind} onChange={e => setKind(e.target.value)}>
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="form-label text-sm">
          Topic
          <input className="form-input" required maxLength={100} value={topic} onChange={e => setTopic(e.target.value)} />
        </label>
        <label className="form-label text-sm">
          Difficulty
          <select className="form-select" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="form-label text-sm">
          Marks
          <input className="form-input" type="number" min={1} max={100} required value={marks} onChange={e => setMarks(e.target.value)} />
        </label>
      </div>
      {kind !== 'written' && (
        <fieldset className="border border-line rounded-md p-3">
          <legend className="font-semibold text-sm px-1">Answer choices</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {LETTERS.map((letter, i) => (
              <label key={letter} className="form-label mb-0 text-sm">
                Choice {letter}
                <input
                  className="form-input"
                  maxLength={500}
                  required
                  value={choices[i]}
                  onChange={e => setChoices(prev => prev.map((c, idx) => idx === i ? e.target.value : c))}
                />
              </label>
            ))}
          </div>
          {kind === 'single' ? (
            <label className="form-label text-sm">
              Correct answer
              <select className="form-select" value={correct} onChange={e => setCorrect(Number(e.target.value))}>
                {LETTERS.map((l, i) => <option key={i} value={i}>{l}</option>)}
              </select>
            </label>
          ) : (
            <fieldset className="border-0 p-0">
              <legend className="text-sm font-semibold mb-1">Correct answers</legend>
              <div className="flex gap-4">
                {LETTERS.map((l, i) => (
                  <label key={i} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={correctSet.includes(i)} onChange={() => toggleCorrectSet(i)} />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </fieldset>
      )}
      <FormError>{error}</FormError>
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  )
}

export default function BankView({ notify }) {
  const [bank, setBank] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const dialogRef = useRef(null)

  async function load() {
    setLoading(true)
    try { setBank(await examRequest('bank')) }
    catch (err) { notify(err.message, true) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editingQuestion && !dialog.open) dialog.showModal()
    else if (!editingQuestion && dialog.open) dialog.close()
  }, [editingQuestion])

  async function handleSave(payload) {
    setSaveBusy(true)
    try {
      await examRequest('bank_save', payload)
      notify(payload.id ? 'Question updated.' : 'Question added to bank.')
      setEditingQuestion(null)
      await load()
    } finally {
      setSaveBusy(false)
    }
  }

  async function handleDelete(q) {
    if (!window.confirm(`Delete "${q.prompt.slice(0, 60)}" from the Question Bank?`)) return
    setDeletingId(q.id)
    try {
      await examRequest('bank_delete', { id: q.id })
      notify('Question deleted.')
      await load()
    } catch (err) {
      notify(err.message, true)
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = bank.filter(q =>
    (q.topic + ' ' + q.difficulty + ' ' + q.prompt).toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <Breadcrumb back="Back to Examinations" backHref="/workspace" current="Question bank" />
      <PageHeader
        title="Question bank"
        description="Create reusable questions and organize them by topic and difficulty."
        action={<span className="text-sm bg-soft text-muted rounded-full px-3 py-1 font-medium">{bank.length} {bank.length === 1 ? 'question' : 'questions'}</span>}
      />

      <Panel className="mb-6">
        <h2 className="mb-3">New question</h2>
        <BankQuestionForm onSave={handleSave} busy={saveBusy} />
      </Panel>

      <Panel>
        <label className="form-label mb-4 text-sm">
          Filter questions
          <input className="form-input" type="search" placeholder="Search topic, difficulty, text…"
            value={filter} onChange={e => setFilter(e.target.value)} />
        </label>

        {loading ? <p className="text-muted text-sm">Loading…</p> : filtered.length === 0 ? (
          <p className="text-muted text-sm">{bank.length ? 'No matches.' : 'No questions yet.'}</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(q => (
              <div key={q.id} className="border border-line rounded-lg p-4 flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold mb-1 overflow-wrap-anywhere">{q.prompt}</p>
                  <p className="text-xs text-muted">{q.topic} · {q.difficulty} · {q.kind} · {q.marks}m</p>
                </div>
                <div className="flex gap-2 flex-none">
                  <Button variant="secondary" className="text-xs" onClick={() => setEditingQuestion(q)}>Edit</Button>
                  <Button
                    variant="secondary"
                    className="text-xs text-error"
                    disabled={deletingId === q.id}
                    onClick={() => handleDelete(q)}
                  >
                    {deletingId === q.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Edit Question Modal */}
      <dialog
        ref={dialogRef}
        className="account-dialog bank-dialog"
        aria-labelledby="bank-edit-title"
        onCancel={e => { e.preventDefault(); if (!saveBusy) setEditingQuestion(null) }}
      >
        <div className="account-dialog-heading">
          <div>
            <h2 id="bank-edit-title">Edit question</h2>
            <p className="text-sm text-muted">
              {editingQuestion ? `${editingQuestion.topic} · ${editingQuestion.difficulty} · ${editingQuestion.marks} marks` : ''}
            </p>
          </div>
          <button
            className="account-close secondary"
            type="button"
            aria-label="Close edit dialog"
            onClick={() => { if (!saveBusy) setEditingQuestion(null) }}
          >
            ×
          </button>
        </div>
        <div className="p-6">
          {editingQuestion && (
            <BankQuestionForm
              key={editingQuestion.id}
              q={editingQuestion}
              onSave={handleSave}
              onCancel={() => setEditingQuestion(null)}
              busy={saveBusy}
              submitLabel="Save changes"
            />
          )}
        </div>
      </dialog>
    </div>
  )
}
