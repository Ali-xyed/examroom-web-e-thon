import { useState, useEffect } from 'react'
import { examRequest } from '../api.js'
import { PageHeader, Panel, Button, FormError, Breadcrumb } from '../components/ui.jsx'

const LETTERS = ['A', 'B', 'C', 'D']
const KINDS = [['single', 'Single-answer MCQ'], ['multiple', 'Multiple-select MCQ'], ['written', 'Written response']]
const DIFFICULTIES = ['easy', 'medium', 'hard']

function BankQuestionForm({ q = {}, onSave, onCancel, busy }) {
  const [kind, setKind] = useState(q.kind || 'single')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const data = new FormData(e.currentTarget)
    const payload = {
      id: q.id,
      prompt: data.get('prompt'),
      kind,
      topic: data.get('topic'),
      difficulty: data.get('difficulty'),
      marks: Number(data.get('marks')),
      choices: kind === 'written' ? ['Unused 0', 'Unused 1', 'Unused 2', 'Unused 3'] : data.getAll('choice'),
      correct: kind === 'single' ? Number(data.get('correct')) : 0,
      correctSet: kind === 'multiple' ? data.getAll('correctSet').map(Number) : [],
    }
    try { await onSave(payload) }
    catch (err) { setError(err.message) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="form-label">Question <textarea className="form-textarea" name="prompt" required maxLength={2000} defaultValue={q.prompt || ''} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="form-label text-sm">Type
          <select className="form-select" name="kind" value={kind} onChange={e => setKind(e.target.value)}>
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="form-label text-sm">Topic <input className="form-input" name="topic" required maxLength={100} defaultValue={q.topic || 'General'} /></label>
        <label className="form-label text-sm">Difficulty
          <select className="form-select" name="difficulty" defaultValue={q.difficulty || 'easy'}>
            {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="form-label text-sm">Marks <input className="form-input" name="marks" type="number" min={1} max={100} defaultValue={q.marks || 1} required /></label>
      </div>
      {kind !== 'written' && (
        <fieldset className="border border-line rounded-md p-3">
          <legend className="font-semibold text-sm px-1">Choices</legend>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {LETTERS.map((letter, i) => (
              <label key={letter} className="form-label mb-0 text-sm">
                {letter} <input className="form-input" name="choice" maxLength={500} defaultValue={q.choices?.[i] || ''} required />
              </label>
            ))}
          </div>
          {kind === 'single' ? (
            <label className="form-label text-sm">Correct answer
              <select className="form-select" name="correct" defaultValue={q.correct ?? 0}>
                {LETTERS.map((l, i) => <option key={i} value={i}>{l}</option>)}
              </select>
            </label>
          ) : (
            <fieldset className="border-0 p-0">
              <legend className="text-sm font-semibold mb-1">Correct answers</legend>
              <div className="flex gap-3">
                {LETTERS.map((l, i) => (
                  <label key={i} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="checkbox" name="correctSet" value={i} defaultChecked={q.correct_set?.includes(i)} />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </fieldset>
      )}
      <FormError>{error}</FormError>
      <div className="flex gap-2 justify-end">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save question'}</Button>
      </div>
    </form>
  )
}

export default function BankView({ notify }) {
  const [bank, setBank] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [showNew, setShowNew] = useState(true)

  async function load() {
    setLoading(true)
    try { setBank(await examRequest('bank')) }
    catch (err) { notify(err.message, true) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleSave(payload) {
    setSaveBusy(true)
    try {
      await examRequest('bank_save', payload)
      notify(payload.id ? 'Question updated.' : 'Question added to bank.')
      setEditingId(null)
      await load()
    } finally {
      setSaveBusy(false)
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
        action={<span className="text-sm bg-soft text-muted rounded px-3 py-1">{bank.length} {bank.length === 1 ? 'question' : 'questions'}</span>}
      />

      {/* New question form */}
      {showNew && (
        <Panel className="mb-6">
          <h2>New question</h2>
          <BankQuestionForm onSave={handleSave} busy={saveBusy} />
        </Panel>
      )}

      {/* Bank list */}
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
              <div key={q.id} className="border border-line rounded-lg p-4">
                {editingId === q.id ? (
                  <BankQuestionForm q={q} onSave={handleSave} onCancel={() => setEditingId(null)} busy={saveBusy} />
                ) : (
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="font-semibold mb-1 overflow-wrap-anywhere">{q.prompt}</p>
                      <p className="text-xs text-muted">{q.topic} · {q.difficulty} · {q.kind} · {q.marks}m</p>
                    </div>
                    <Button variant="secondary" className="text-xs flex-none" onClick={() => setEditingId(q.id)}>Edit</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
