const avatarNames = ['pile-1.webp', 'pile-2.webp', 'pile-3.webp', 'pile-4.webp']

function artwork(name, className = '') {
  return `<img src="/reference/${name}" alt="" class="${className}">`
}

export const landingNav = `<nav class="landing-nav" aria-label="Overview">
  <a href="#roles">Workspaces</a>
  <a href="#how">How it works</a>
  <a href="#demo">Live demo</a>
  <a href="#features">Features</a>
  <a href="#faq">FAQ</a>
</nav>`

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
  ['How can institutions verify a candidate’s PDF report?', 'Every published PDF report includes a unique verification token and link that anyone can validate against the public verification endpoint.'],
]

const examRows = [
  ['WEB101', 'Web fundamentals', '09:00 AM', '20 min'],
  ['CS201', 'Data structures', '10:00 AM', '30 min'],
  ['CS301', 'Database systems', '11:30 AM', '45 min'],
  ['SE201', 'Software engineering', '02:00 PM', '30 min'],
  ['NET101', 'Computer networks', '03:00 PM', '25 min'],
]

function landingDemo() {
  return `<div class="product-wrap reveal-3d" data-reveal="up"><div class="product-stage tilt-3d" id="demo">
    ${artwork('book-sticker.svg', 'sticker sticker-book')}
    ${artwork('check-sticker.svg', 'sticker sticker-check')}
    ${artwork('pile-1.webp', 'sticker sticker-face')}
    ${artwork('bulb-sticker.svg', 'sticker sticker-bulb')}
    <div class="product-browser">
      <div class="product-bar" aria-hidden="true"><i></i><i></i><i></i><span>uncooked.exam / candidate-workspace</span></div>
      <div class="product-body">
        <div class="product-tabs">
          <button class="primary" type="button" data-preview="exams" aria-pressed="true">My exams</button>
          <button type="button" data-preview="workspace" aria-pressed="false">Exam workspace</button>
        </div>
        <div data-preview-panel="exams">
          <div class="product-summary"><div><h3>Ayaan Malik · Candidate</h3><p>Assigned examinations</p></div>
            <div class="product-stats">
              <div><small>Exams</small><strong>5</strong></div><div><small>Available</small><strong>1</strong></div>
              <div><small>Completed</small><strong>2</strong></div>
            </div>
          </div>
          <div class="product-table"><table>
            <thead><tr><th scope="col">Code</th><th scope="col">Examination</th><th scope="col">Opens</th><th scope="col">Duration</th></tr></thead>
            <tbody>${examRows.map(row => '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>').join('')}</tbody>
          </table></div>
          <div class="product-caption"><span class="button primary" aria-hidden="true">▤ &nbsp; Exam schedule</span><span>Live candidate preview</span></div>
        </div>
        <div class="workspace-preview" data-preview-panel="workspace" hidden>
          <div><h3>Web fundamentals</h3><p>Which HTML element represents the main content of a page?</p>
            <div class="preview-choices"><span>A &nbsp; aside</span><span class="sample-answer">B &nbsp; main</span><span>C &nbsp; nav</span><span>D &nbsp; footer</span></div>
          </div>
          <div class="preview-progress"><span aria-hidden="true">✓</span><h4>Answer saved</h4><p>Synced to server &amp; local cache.</p><strong>1 of 3 answered</strong></div>
        </div>
      </div>
    </div>
  </div></div>`
}

export function landing() {
  return `
  <section class="landing-hero">
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="hero-grid">
      <div class="hero-copy">
        <span class="hero-pill reveal-3d" data-reveal="up"><i aria-hidden="true"></i>Server-enforced timing &amp; live autosave</span>
        <div class="hero-avatars reveal-3d" data-reveal="up" aria-hidden="true">
          ${[...avatarNames, 'folder-face.svg', 'glasses-face.svg', 'squiggle-face.svg'].map(name => artwork(name)).join('')}
        </div>
        <h1 class="reveal-3d" data-reveal="up">
          <span>Where institutions</span>
          <span class="hero-second">run <span class="hero-highlight"><i aria-hidden="true"></i>online exams</span></span>
        </h1>
        <p class="hero-description reveal-3d" data-reveal="up">
          Create scheduled exams, drag and drop from your Question Bank, and deliver timed assessments with offline-resilient autosave and verified PDF reports.
        </p>
        <div class="hero-actions reveal-3d" data-reveal="up">
          <a class="button primary hero-cta" href="/login">Sign in to workspace <span aria-hidden="true">→</span></a>
          <a class="button secondary" href="#demo">Explore live demo</a>
        </div>
        <div class="hero-trust reveal-3d" data-reveal="up">
          <span><i></i>Role-based access</span>
          <span><i></i>Offline-safe recovery</span>
          <span><i></i>Verified PDF reports</span>
        </div>
      </div>
      ${landingDemo()}
    </div>
  </section>

  <section class="tool-section reveal-3d" data-reveal="up" aria-label="Technology">
    <p>Engineered for reliability at scale</p>
    <ul><li>JavaScript ES2024</li><li>Supabase Auth &amp; RLS</li><li>PostgreSQL</li><li>Service Worker Cache</li><li>Vercel Edge</li></ul>
  </section>

  <section class="roles-section" id="roles">
    <div class="landing-container">
      <div class="section-head reveal-3d" data-reveal="up">
        <div class="section-label">Three dedicated workspaces</div>
        <h2>One platform. Every role covered.</h2>
        <p class="section-intro">Tailored interfaces for examiners, candidates, and administrators—each with clear controls and zero clutter.</p>
      </div>
      <div class="roles-grid">
        ${roleCards.map(([role, subtitle, body, icon], i) => `
          <article class="role-card tilt-3d reveal-3d" data-reveal="${i === 0 ? 'left' : i === 2 ? 'right' : 'up'}" style="--delay:${i * 70}ms">
            <div class="role-card-top"><span class="role-icon" aria-hidden="true">${icon}</span><span class="role-tag">${role}</span></div>
            <h3>${subtitle}</h3>
            <p>${body}</p>
            <a class="role-link" href="/login">Open ${role.toLowerCase()} view <span aria-hidden="true">→</span></a>
          </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="how-section" id="how">
    <div class="landing-container">
      <div class="section-head center reveal-3d" data-reveal="up">
        <div class="section-label">How it works</div>
        <h2>From setup to verified results in four steps.</h2>
        <p class="section-intro">Scroll through the end-to-end examination lifecycle.</p>
      </div>
      <div class="timeline-wrap" id="how-timeline">
        <div class="timeline-track" aria-hidden="true"><div class="timeline-fill" id="how-progress-line"></div></div>
        <ol class="timeline-steps">
          ${steps.map(([num, title, body], index) => {
            const side = index % 2 === 0 ? 'left' : 'right'
            return `<li class="timeline-item ${side}">
              <span class="timeline-node" aria-hidden="true">${num}</span>
              <article class="timeline-card tilt-3d reveal-3d" data-reveal="${side}">
                <span class="timeline-step-tag">Step ${num}</span>
                <h3>${title}</h3>
                <p>${body}</p>
              </article>
            </li>`
          }).join('')}
        </ol>
      </div>
    </div>
  </section>

  <section class="feature-section" id="features">
    <div class="landing-container">
      <div class="feature-heading reveal-3d" data-reveal="up">
        <div><div class="section-label">Capabilities</div><h2>Built like a real-world exam engine</h2></div>
        <p class="section-intro">Every detail—from drag-and-drop authoring to tamper-proof deadlines—works out of the box.</p>
      </div>
      <div class="bento-grid">
        <article class="bento-card bento-wide tilt-3d reveal-3d" data-reveal="up">
          <div class="bento-meta">01 · Integrity</div>
          <h3>Server-enforced timing &amp; live sync</h3>
          <p>Deadlines are computed on the server. Refreshing the tab, switching networks, or changing the device clock never grants extra time.</p>
          <div class="bento-meter" aria-hidden="true">
            <div class="bento-meter-row"><span>Server clock lock</span><strong>Active</strong></div>
            <div class="bento-bar"><span style="width:92%"></span></div>
            <div class="bento-meter-row"><span>Local + cloud autosave</span><strong>100% synced</strong></div>
            <div class="bento-bar"><span style="width:100%"></span></div>
          </div>
        </article>
        <article class="bento-card tilt-3d reveal-3d" data-reveal="up" style="--delay:80ms">
          <div class="bento-meta">02 · Authoring</div>
          <h3>Drag-and-drop Question Bank</h3>
          <p>Maintain reusable single-choice, multiple-select, and written questions. Drag them straight into new exams.</p>
        </article>
        <article class="bento-card tilt-3d reveal-3d" data-reveal="up" style="--delay:120ms">
          <div class="bento-meta">03 · Scale</div>
          <h3>Editable JSON Bulk Import</h3>
          <p>Import up to 200 users or questions at once, edit any row inline in the preview, and fix issues before committing.</p>
        </article>
        <article class="bento-card bento-wide tilt-3d reveal-3d" data-reveal="up" style="--delay:160ms">
          <div class="bento-meta">04 · Analytics &amp; Reports</div>
          <h3>Instant grading, analytics &amp; verifiable PDFs</h3>
          <p>Review question difficulty, grade written responses inline, publish results, and issue cryptographically signed PDF scorecards.</p>
          <div class="bento-chips" aria-hidden="true">
            <span>✓ Partial multi-select marking</span>
            <span>✓ Incident signals</span>
            <span>✓ PDF verification token</span>
          </div>
        </article>
      </div>
    </div>
  </section>

  <section class="faq-section" id="faq">
    <div class="landing-container">
      <div class="section-head center reveal-3d" data-reveal="up">
        <div class="section-label">Questions</div>
        <h2>Frequently asked</h2>
      </div>
      <div class="faq-list">
        ${faqs.map(([q, a], i) => `<details class="faq-item reveal-3d" data-reveal="up" style="--delay:${i * 50}ms">
          <summary>${q}<span class="faq-plus" aria-hidden="true">+</span></summary>
          <p>${a}</p>
        </details>`).join('')}
      </div>
    </div>
  </section>

  <section class="cta-section reveal-3d" data-reveal="up">
    <div class="landing-container">
      <div class="cta-card tilt-3d">
        <div class="cta-glow" aria-hidden="true"></div>
        <h2>Ready to conduct your next exam?</h2>
        <p>Sign in with your institutional account to build exams, manage candidates, or take an assigned assessment.</p>
        <div class="hero-actions">
          <a class="button primary hero-cta" href="/login">Open UnCooked <span aria-hidden="true">→</span></a>
          <a class="button secondary" href="#how">Review workflow</a>
        </div>
      </div>
    </div>
  </section>

  <footer class="landing-footer">
    <div class="footer-watermark" aria-hidden="true">UnCooked</div>
    <div class="landing-container footer-inner">
      <div class="footer-grid">
        <div class="footer-brand-col">
          <a class="brand" href="/"><img class="logo" src="/reference/uc-logo.png" alt=""> UnCooked</a>
          <p>Secure, distraction-free examination management for institutions, examiners, and candidates.</p>
          <span class="footer-status"><i aria-hidden="true"></i> All systems operational</span>
        </div>
        <div>
          <h4>Platform</h4>
          <ul>
            <li><a href="#roles">Workspaces</a></li>
            <li><a href="#how">How it works</a></li>
            <li><a href="#demo">Live demo</a></li>
            <li><a href="#features">Features</a></li>
          </ul>
        </div>
        <div>
          <h4>Access</h4>
          <ul>
            <li><a href="/login">Sign in</a></li>
            <li><a href="/login#bank">Question bank</a></li>
            <li><a href="/login#create">New examination</a></li>
            <li><a href="/login#import">Bulk import</a></li>
          </ul>
        </div>
        <div>
          <h4>Resources</h4>
          <ul>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="/login#users">User management</a></li>
            <li><a href="#features">Security &amp; fairness</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; ${new Date().getFullYear()} UnCooked · Web-e-Thon Secure Examination Management System.</p>
        <p>Built with server-enforced timing &amp; offline-resilient sync.</p>
      </div>
    </div>
  </footer>`
}

export function initLandingEffects() {
  const header = document.querySelector('.top')
  const onScroll = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 18)
    const timeline = document.querySelector('#how-timeline')
    const fill = document.querySelector('#how-progress-line')
    if (timeline && fill) {
      const rect = timeline.getBoundingClientRect()
      const viewH = window.innerHeight
      const progress = Math.min(1, Math.max(0, (viewH * 0.72 - rect.top) / Math.max(1, rect.height)))
      fill.style.transform = `scaleY(${progress})`
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  const reveals = [...document.querySelectorAll('.reveal-3d')]
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    reveals.forEach(el => observer.observe(el))
  } else {
    reveals.forEach(el => el.classList.add('is-visible'))
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduced) {
    document.querySelectorAll('.tilt-3d').forEach(card => {
      card.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse') return
        const rect = card.getBoundingClientRect()
        const x = (event.clientX - rect.left) / rect.width - 0.5
        const y = (event.clientY - rect.top) / rect.height - 0.5
        card.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`)
        card.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`)
      })
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg')
        card.style.setProperty('--ry', '0deg')
      })
    })
  }
}

export const authPanel = `<aside class="intro" aria-labelledby="entry-title"><div class="intro-content">
  <span class="auth-badge">Secure Examination Management System</span>
  <div class="auth-hero"><div class="auth-avatars" aria-hidden="true">${avatarNames.map(name => artwork(name)).join('')}</div>
  <h2 id="entry-title"><span>Secure exams</span><span>for institutions</span><span>and candidates.</span></h2></div>
  <p>Set up and publish assessments, take assigned exams, and submit answers with server-enforced timing.</p>
</div></aside>`
