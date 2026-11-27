// Landing page — mirrors site.js content in React/Tailwind

const steps = [
  ['01', 'Sign in to your workspace', 'Use the credentials provided by your institution administrator to enter your dedicated role workspace—Administrator, Examiner, or Candidate.'],
  ['02', 'Build from the Question Bank', 'Examiners organize reusable MCQs, multi-select, and written questions, then drag and drop them directly into scheduled examinations.'],
  ['03', 'Take the exam with live sync', 'Candidates start within the server-enforced window, flag questions for review, and work seamlessly even if the connection flickers.'],
  ['04', 'Grade, publish & verify PDFs', 'Examiners monitor incidents, grade written responses, publish results, and issue cryptographically verifiable PDF score reports.'],
]

const roleCards = [
  ['Examiners', 'Build & invigilate', 'Create question banks, drag-and-drop into exams, monitor active attempts in real time, grade written answers, and view question analytics.', '◈'],
  ['Candidates', 'Focus & submit', 'Distraction-free exam workspace with live countdown, question navigator, review flags, scratchpad, and instant submission receipts.', '◉'],
  ['Administrators', 'Govern & scale', 'Manage user accounts, roles, and access states, or bulk-import hundreds of candidates via editable JSON preview.', '◆'],
]

const faqs = [
  ['What happens if a candidate refreshes or loses internet mid-exam?', 'Every answer and review flag is saved both locally and to the server. When the candidate reconnects or refreshes, their exact progress and server-enforced deadline are restored automatically.'],
  ['Can a candidate extend their exam time by changing their device clock?', 'No. All start times, deadlines, and auto-submissions are enforced by the server clock, ensuring strict fairness across every attempt.'],
  ['How does bulk JSON import work for users and questions?', 'Upload a JSON array of up to 200 records, preview and edit any field inline—including fixing duplicate emails or typos—and confirm the import in one click.'],
  ['How can institutions verify a candidate\'s PDF report?', 'Every published PDF report includes a unique verification token and link that anyone can validate against the public verification endpoint.'],
]

const examRows = [
  ['WEB101', 'Web fundamentals', '09:00 AM', '20 min'],
  ['CS201', 'Data structures', '10:00 AM', '30 min'],
  ['CS301', 'Database systems', '11:30 AM', '45 min'],
  ['SE201', 'Software engineering', '02:00 PM', '30 min'],
  ['NET101', 'Computer networks', '03:00 PM', '25 min'],
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 bg-white/95 border-b border-line backdrop-blur-md">
        <div className="w-full max-w-[1160px] mx-auto px-6 min-h-[3.45rem] flex gap-4 justify-between items-center">
          <a href="/" className="flex items-center gap-1 font-bold text-[1.1rem] tracking-tight text-ink no-underline">
            <img className="block w-14 h-7 object-contain" src="/reference/uc-logo.png" alt="" />
            UnCooked
          </a>
          <nav className="hidden md:flex gap-6 text-sm">
            <a href="#roles" className="text-muted hover:text-ink transition-colors">Workspaces</a>
            <a href="#how" className="text-muted hover:text-ink transition-colors">How it works</a>
            <a href="#features" className="text-muted hover:text-ink transition-colors">Features</a>
            <a href="#faq" className="text-muted hover:text-ink transition-colors">FAQ</a>
          </nav>
          <a href="/login" className="btn-primary">Log in</a>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1080px] mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight mb-4">
          Secure online examinations,<br />built for institutions.
        </h1>
        <p className="text-muted text-lg max-w-2xl mx-auto mb-8">
          UnCooked brings examiners, candidates, and administrators into a single platform with
          live sync, server-enforced deadlines, and verifiable PDF score reports.
        </p>
        <div className="flex gap-3 justify-center">
          <a href="/login" className="btn-primary text-base px-6 py-3">Get started →</a>
          <a href="#how" className="btn-secondary text-base px-6 py-3">How it works</a>
        </div>
      </section>

      {/* Demo mockup */}
      <section className="max-w-[1080px] mx-auto px-6 pb-16" id="demo">
        <div className="panel overflow-hidden">
          <div className="bg-surface border-b border-line px-4 py-2 flex items-center gap-2 text-xs text-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57] inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e] inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840] inline-block"></span>
            <span className="ml-2">uncooked.exam / candidate-workspace</span>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold">Ayaan Malik · Candidate</h3>
                <p className="text-sm text-muted">Assigned examinations</p>
              </div>
              <div className="flex gap-4 text-center text-sm">
                <div><div className="text-muted text-xs">Exams</div><strong>5</strong></div>
                <div><div className="text-muted text-xs">Available</div><strong>1</strong></div>
                <div><div className="text-muted text-xs">Completed</div><strong>2</strong></div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left pb-2 font-semibold text-muted">Code</th>
                    <th className="text-left pb-2 font-semibold text-muted">Examination</th>
                    <th className="text-left pb-2 font-semibold text-muted">Opens</th>
                    <th className="text-left pb-2 font-semibold text-muted">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {examRows.map(([code, name, opens, dur]) => (
                    <tr key={code} className="border-b border-line last:border-0">
                      <td className="py-2 text-muted">{code}</td>
                      <td className="py-2 font-medium">{name}</td>
                      <td className="py-2">{opens}</td>
                      <td className="py-2">{dur}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Role cards */}
      <section className="max-w-[1080px] mx-auto px-6 pb-16" id="roles">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Three workspaces, one platform</h2>
        <p className="text-muted mb-8">Every role gets a tailored interface built for their specific responsibilities.</p>
        <div className="grid md:grid-cols-3 gap-4">
          {roleCards.map(([title, subtitle, desc, icon]) => (
            <div key={title} className="panel p-6">
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-bold text-lg mb-0.5">{title}</h3>
              <p className="text-sm text-muted font-medium mb-2">{subtitle}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface border-y border-line py-16" id="how">
        <div className="max-w-[1080px] mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight mb-8">How it works</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {steps.map(([num, title, desc]) => (
              <div key={num} className="flex gap-4">
                <div className="text-3xl font-black text-soft w-10 flex-none">{num}</div>
                <div>
                  <h3 className="font-bold mb-1">{title}</h3>
                  <p className="text-sm text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1080px] mx-auto px-6 py-16" id="features">
        <h2 className="text-3xl font-bold tracking-tight mb-8">Key features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ['🔒', 'Server-enforced deadlines', 'Attempts close automatically at the server deadline regardless of the client clock.'],
            ['📡', 'Offline resilience', 'Answers queue locally and sync on reconnect with revision conflict resolution.'],
            ['📋', 'Mixed question types', 'Single-answer MCQ, multi-select with exact matching, and manually graded written responses.'],
            ['📊', 'Live exam monitoring', 'Real-time integrity feed, incident tracking, and progress monitoring per candidate.'],
            ['📄', 'Verifiable PDF reports', 'Cryptographically signed score reports with public verification endpoint.'],
            ['📥', 'Bulk JSON import', 'Import up to 200 candidate accounts or question-bank records with inline validation.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="panel p-5">
              <div className="text-2xl mb-2">{icon}</div>
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-surface border-t border-line py-16" id="faq">
        <div className="max-w-[800px] mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight mb-8">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map(([q, a]) => (
              <details key={q} className="panel p-5 group">
                <summary className="cursor-pointer font-semibold list-none flex justify-between items-center">
                  {q}
                  <span className="text-muted ml-2">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-8">
        <div className="max-w-[1080px] mx-auto px-6 flex flex-wrap gap-4 justify-between items-center text-sm text-muted">
          <span>UnCooked · Secure Examination Management System</span>
          <a href="/login" className="btn-primary">Sign in →</a>
        </div>
      </footer>
    </div>
  )
}
