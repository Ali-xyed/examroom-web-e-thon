import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, Pill, MetadataList } from '../components/ui.jsx'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
function date(value) { return dateFormat.format(new Date(value)) }

function statusOf(exam, now) {
  if (!exam.published) return 'Draft'
  if (exam.submitted_at) return 'Completed'
  if (now < Date.parse(exam.opens_at)) return 'Upcoming'
  if (now >= Date.parse(exam.closes_at)) return 'Closed'
  return 'Ongoing'
}

function statusPillVariant(status) {
  if (status === 'Upcoming') return 'upcoming'
  if (status === 'Ongoing') return 'available'
  return 'default'
}

export default function HomeView({ dashboard, onReload, notify }) {
  const { profile, exams, serverTime } = dashboard
  const now = Date.parse(serverTime)
  const examiner = profile.role === 'examiner'
  const candidate = profile.role === 'candidate'

  const title = candidate ? 'My examinations' : examiner ? 'Examinations' : 'Platform overview'
  const descriptions = {
    candidate: 'View your assigned examinations and their availability.',
    examiner: 'Create examinations, enroll candidates, and review attempts.',
    administrator: 'View examination activity across the platform.',
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={descriptions[profile.role]}
        action={examiner ? <Link to="/workspace/create" className="btn-primary">New examination</Link> : null}
      />
      {profile.role !== 'candidate' && (
        <div className="flex gap-2 mb-4">
          <Link to="/workspace/import" className="btn-secondary">Bulk import</Link>
          {examiner && <Link to="/workspace/bank" className="btn-secondary">Question bank</Link>}
          {profile.role === 'administrator' && <Link to="/workspace/users" className="btn-secondary">Manage users</Link>}
        </div>
      )}

      <section className="grid gap-3" aria-label="Examinations">
        {exams.length ? (
          exams.map(exam => {
            const status = statusOf(exam, now)
            const open = candidate && status !== 'Upcoming'
            return (
              <article key={exam.id} className="panel flex items-center justify-between gap-4 px-6 py-5">
                <div>
                  <Pill variant={statusPillVariant(status)}>{status}</Pill>
                  <h2 className="text-base font-semibold mt-2 mb-3 overflow-wrap-anywhere">{exam.title}</h2>
                  {candidate && exam.instructions && (
                    <p className="text-sm text-muted whitespace-pre-wrap mb-3">{exam.instructions}</p>
                  )}
                  <MetadataList items={[
                    ['Opens', date(exam.opens_at)],
                    ['Closes', date(exam.closes_at)],
                    ['Duration', `${exam.duration} min`],
                  ]} />
                </div>
                <div className="flex flex-col gap-2 flex-none">
                  {examiner && (
                    <Link to={`/workspace/manage/${exam.id}`} className="btn-secondary">Manage exam</Link>
                  )}
                  {open && (
                    <Link to={`/exam/${exam.id}`} className="btn-primary">Open exam</Link>
                  )}
                  {candidate && (
                    <Link to={`/workspace/result/${exam.id}`} className="btn-secondary">View result</Link>
                  )}
                </div>
              </article>
            )
          })
        ) : (
          <p className="panel p-6 text-muted">No examinations to show.</p>
        )}
      </section>
    </div>
  )
}
