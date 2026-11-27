const avatarNames = ['pile-1.webp', 'pile-2.webp', 'pile-3.webp', 'pile-4.webp']

function artwork(name, className = '') {
  return `<img src="/reference/${name}" alt="" class="${className}">`
}

export const landingNav = `<nav class="landing-nav" aria-label="Overview">
  <a href="#how">How it works</a><a href="#demo">Demo</a><a href="#features">Features</a>
</nav>`

const steps = [
  ['Sign in to UnCooked', 'Use the account provided by your administrator to access your role’s workspace.'],
  ['Create and publish an exam', 'The examiner sets the schedule, adds questions, and enrolls the candidates.'],
  ['Open your assigned exam', 'Candidates can start during the exam window, navigate questions, and flag items for review.'],
  ['Review and submit', 'Answers save as you work. Review your progress and submit before the deadline.'],
]

const features = [
  ['Who can open an exam?', 'Examiners control enrollment, and candidates can only open exams assigned to them.', 'Role-based access', '♙'],
  ['When can a candidate start?', 'Candidates can begin within the published window. The server enforces the attempt deadline.', 'Timed exams', '◷'],
  ['What happens after a refresh?', 'Saved answers, review flags, and the original deadline are restored when the candidate returns.', 'Autosave', '↻'],
  ['Which questions need another look?', 'The navigator distinguishes answered, unanswered, and flagged questions while the exam is in progress.', 'Question navigation', '▤'],
  ['How do I know it was submitted?', 'Candidates get a submission receipt, and examiners can check the status of each enrolled candidate.', 'Submission tracking', '✓'],
]

const examRows = [
  ['WEB101', 'Web fundamentals', '09:00 AM', '20 min'],
  ['CS201', 'Data structures', '10:00 AM', '30 min'],
  ['CS301', 'Database systems', '11:30 AM', '45 min'],
  ['SE201', 'Software engineering', '02:00 PM', '30 min'],
  ['NET101', 'Computer networks', '03:00 PM', '25 min'],
]

function landingDemo() {
  return `<div class="product-wrap"><div class="product-stage" id="demo">
    ${artwork('book-sticker.svg', 'sticker sticker-book')}
    ${artwork('check-sticker.svg', 'sticker sticker-check')}
    ${artwork('pile-1.webp', 'sticker sticker-face')}
    ${artwork('bulb-sticker.svg', 'sticker sticker-bulb')}
    <div class="product-browser">
      <div class="product-bar" aria-hidden="true"><i></i><i></i><i></i><span>UnCooked / Candidate</span></div>
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
          <div class="product-caption"><span class="button primary" aria-hidden="true">▤ &nbsp; Exam schedule</span><span>Sample candidate view</span></div>
        </div>
        <div class="workspace-preview" data-preview-panel="workspace" hidden>
          <div><h3>Web fundamentals</h3><p>Which HTML element represents the main content of a page?</p>
            <div class="preview-choices"><span>A &nbsp; aside</span><span class="sample-answer">B &nbsp; main</span><span>C &nbsp; nav</span><span>D &nbsp; footer</span></div>
          </div>
          <div class="preview-progress"><span aria-hidden="true">✓</span><h4>Answer saved</h4><p>Your changes are recorded.</p><strong>1 of 3 answered</strong></div>
        </div>
      </div>
    </div>
  </div></div>`
}

export function landing() {
  return `<section class="landing-hero"><div class="hero-copy">
    <div class="hero-avatars" aria-hidden="true">
      ${[...avatarNames, 'folder-face.svg', 'glasses-face.svg', 'squiggle-face.svg'].map(name => artwork(name)).join('')}
    </div>
    <h1><span>Where institutions</span><span class="hero-second">run <span class="hero-highlight"><i aria-hidden="true"></i>online exams</span></span></h1>
    <p class="hero-description">Create scheduled exams, enroll candidates, and run timed assessments with automatic answer saving.</p>
    <div class="hero-actions"><a class="button primary" href="/login">Sign in</a><a class="button secondary" href="#demo">See the demo</a></div>
    <p class="hero-note">Web-e-Thon · Accounts are created by your administrator</p>
  </div>${landingDemo()}</section>
  <section class="tool-section" aria-label="Technology">
    <p>The tech stack behind this product</p>
    <ul><li>JavaScript</li><li>HTML</li><li>CSS</li></ul>
    <ul><li>Supabase Auth</li><li>PostgreSQL</li></ul>
    <ul><li>GitHub</li><li>Vercel</li></ul>
  </section>
  <section class="work-section"><h2>One workspace for every exam.</h2>
    <div class="work-cards">
      <a href="#how"><div><small>Exam setup</small><strong>Build and publish the exam. Give access to the right candidates.</strong></div><span aria-hidden="true">→</span></a>
      <a href="#features"><div><small>Exam delivery</small><strong>Take a timed exam with saved answers and a clear submission receipt.</strong></div><span aria-hidden="true">→</span></a>
    </div>
  </section>
  <section class="how-section" id="how"><div class="landing-container">
    <div class="section-label">The path</div><h2>How it works</h2>
    <p class="section-intro">Four steps from signing in to submitting an attempt.</p>
    <ol class="landing-steps">${steps.map(([title, body], index) => `<li><span aria-hidden="true">0${index + 1}</span>
      <div><h3>${title}</h3><p>${body}</p></div></li>`).join('')}</ol>
  </div></section>
  <section class="feature-section" id="features"><div class="landing-container">
    <div class="feature-heading"><div><div class="section-label">The features</div><h2>Everything you need</h2></div>
      <p class="section-intro">Tools for examiners and candidates, from publishing the exam to recording the final submission.</p></div>
    <div class="feature-list">${features.map(([title, body, label, icon], index) => `<article>
      <span class="feature-number" aria-hidden="true">0${index + 1}</span><div><h3>${title}</h3><p>${body}</p></div>
      <span class="feature-badge"><span aria-hidden="true">${icon}</span>${label}</span></article>`).join('')}</div>
    <div class="fairness-card"><h3>Built for fairness</h3><p>The server checks eligibility and enforces the deadline, so refreshing or changing the device clock cannot extend an attempt.</p></div>
  </div></section>
  <footer class="landing-footer"><div class="landing-container">
    <a class="brand" href="/"><img class="logo" src="/reference/uc-logo.png" alt=""> UnCooked</a>
    <span>Built for the Web-e-Thon Secure Examination Management System.</span>
    <a class="button" href="/login">Sign in <span aria-hidden="true">→</span></a>
  </div></footer>`
}

export const authPanel = `<aside class="intro" aria-labelledby="entry-title"><div class="intro-content">
  <span class="auth-badge">Secure Examination Management System</span>
  <div class="auth-hero"><div class="auth-avatars" aria-hidden="true">${avatarNames.map(name => artwork(name)).join('')}</div>
  <h2 id="entry-title"><span>Secure exams</span><span>for institutions</span><span>and candidates.</span></h2></div>
  <p>Set up and publish assessments, take assigned exams, and submit answers with server-enforced timing.</p>
</div></aside>`
