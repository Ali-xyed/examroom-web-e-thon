import { useRef } from 'react'
import { Link } from 'react-router-dom'
import ProductPreview from '../components/ProductPreview.jsx'
import PublicHeader from '../components/PublicHeader.jsx'
import LandingFooter from '../components/LandingFooter.jsx'
import useLandingEffects from '../hooks/useLandingEffects.js'
import { steps, roleCards, faqs } from '../landingContent.js'
import '../styles/public-site.css'

const avatars = ['pile-1.webp', 'pile-2.webp', 'pile-3.webp', 'pile-4.webp', 'folder-face.svg', 'glasses-face.svg', 'squiggle-face.svg']
const technologies = ['React + Node.js', 'Supabase Auth & RLS', 'PostgreSQL', 'Local answer recovery', 'Vercel']

export default function LandingPage() {
  const pageRef = useRef(null)
  useLandingEffects(pageRef)
  return (
    <div className="public-site" data-view="landing" ref={pageRef}>
      <a className="skip" href="#main">Skip to content</a>
      <PublicHeader />
      <main id="main" tabIndex={-1}>
        <section className="landing-hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="hero-pill reveal-3d" data-reveal="up"><i aria-hidden="true" />Server-enforced timing &amp; live autosave</span>
              <div className="hero-avatars reveal-3d" data-reveal="up" aria-hidden="true">
                {avatars.map(name => <img key={name} src={`/reference/${name}`} alt="" width="48" height="48" />)}
              </div>
              <h1 className="reveal-3d" data-reveal="up">
                <span>Where institutions</span>
                <span className="hero-second">run <span className="hero-highlight"><i aria-hidden="true" />online exams</span></span>
              </h1>
              <p className="hero-description reveal-3d" data-reveal="up">Create scheduled exams, drag and drop from your Question Bank, and deliver timed assessments with offline-resilient autosave and verified PDF reports.</p>
              <div className="hero-actions reveal-3d" data-reveal="up">
                <Link className="button primary hero-cta" to="/login">Sign in to workspace <span aria-hidden="true">→</span></Link>
                <a className="button secondary" href="#demo">Explore live demo</a>
              </div>
              <div className="hero-trust reveal-3d" data-reveal="up">
                {['Role-based access', 'Offline-safe recovery', 'Verified PDF reports'].map(label => <span key={label}><i aria-hidden="true" />{label}</span>)}
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>
        <section className="tool-section reveal-3d" data-reveal="up" aria-label="Technology">
          <p>Engineered for reliability at scale</p>
          <ul>{technologies.map(name => <li key={name}>{name}</li>)}</ul>
        </section>
        <section className="roles-section" id="roles">
          <div className="landing-container">
            <div className="section-head reveal-3d" data-reveal="up">
              <div className="section-label">Three dedicated workspaces</div>
              <h2>One platform. Every role covered.</h2>
              <p className="section-intro">Tailored interfaces for examiners, candidates, and administrators—each with clear controls and zero clutter.</p>
            </div>
            <div className="roles-grid">
              {roleCards.map(([role, subtitle, body, icon], i) => (
                <article key={role} className="role-card tilt-3d reveal-3d" data-reveal={i === 0 ? 'left' : i === 2 ? 'right' : 'up'} style={{ '--delay': `${i * 70}ms` }}>
                  <div className="role-card-top"><span className="role-icon" aria-hidden="true">{icon}</span><span className="role-tag">{role}</span></div>
                  <h3>{subtitle}</h3><p>{body}</p>
                  <Link className="role-link" to="/login">Open {role.toLowerCase()} view <span aria-hidden="true">→</span></Link>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="how-section" id="how">
          <div className="landing-container">
            <div className="section-head center reveal-3d" data-reveal="up">
              <div className="section-label">How it works</div>
              <h2>From setup to verified results in four steps.</h2>
              <p className="section-intro">Scroll through the end-to-end examination lifecycle.</p>
            </div>
            <div className="timeline-wrap" id="how-timeline">
              <div className="timeline-track" aria-hidden="true"><div className="timeline-fill" id="how-progress-line" /></div>
              <ol className="timeline-steps">
                {steps.map(([num, title, body], i) => (
                  <li key={num} className={`timeline-item ${i % 2 === 0 ? 'left' : 'right'}`}>
                    <span className="timeline-node" aria-hidden="true">{num}</span>
                    <article className="timeline-card tilt-3d reveal-3d" data-reveal={i % 2 === 0 ? 'left' : 'right'}>
                      <span className="timeline-step-tag">Step {num}</span><h3>{title}</h3><p>{body}</p>
                    </article>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
        <section className="feature-section" id="features">
          <div className="landing-container">
            <div className="feature-heading reveal-3d" data-reveal="up">
              <div><div className="section-label">Capabilities</div><h2>Built like a real-world exam engine</h2></div>
              <p className="section-intro">Every detail—from drag-and-drop authoring to tamper-proof deadlines—works out of the box.</p>
            </div>
            <div className="bento-grid">
              <article className="bento-card bento-wide tilt-3d reveal-3d" data-reveal="up">
                <div className="bento-meta">01 · Integrity</div>
                <h3>Server-enforced timing &amp; live sync</h3>
                <p>Deadlines are computed on the server. Refreshing the tab, switching networks, or changing the device clock never grants extra time.</p>
                <div className="bento-meter" aria-hidden="true">
                  <div className="bento-meter-row"><span>Server clock lock</span><strong>Active</strong></div>
                  <div className="bento-bar"><span style={{ width: '92%' }} /></div>
                  <div className="bento-meter-row"><span>Local + cloud autosave</span><strong>100% synced</strong></div>
                  <div className="bento-bar"><span style={{ width: '100%' }} /></div>
                </div>
              </article>
              <article className="bento-card tilt-3d reveal-3d" data-reveal="up" style={{ '--delay': '80ms' }}>
                <div className="bento-meta">02 · Authoring</div><h3>Drag-and-drop Question Bank</h3>
                <p>Maintain reusable single-choice, multiple-select, and written questions. Drag them straight into new exams.</p>
              </article>
              <article className="bento-card tilt-3d reveal-3d" data-reveal="up" style={{ '--delay': '120ms' }}>
                <div className="bento-meta">03 · Scale</div><h3>Editable JSON Bulk Import</h3>
                <p>Import up to 200 users or questions at once, edit any row inline in the preview, and fix issues before committing.</p>
              </article>
              <article className="bento-card bento-wide tilt-3d reveal-3d" data-reveal="up" style={{ '--delay': '160ms' }}>
                <div className="bento-meta">04 · Analytics &amp; Reports</div><h3>Instant grading, analytics &amp; verifiable PDFs</h3>
                <p>Review question difficulty, grade written responses inline, publish results, and issue PDF scorecards with verification codes.</p>
                <div className="bento-chips" aria-hidden="true">
                  <span>✓ Exact-match multi-select marking</span><span>✓ Incident signals</span><span>✓ PDF verification token</span>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section className="faq-section" id="faq">
          <div className="landing-container">
            <div className="section-head center reveal-3d" data-reveal="up"><div className="section-label">Questions</div><h2>Frequently asked</h2></div>
            <div className="faq-list">
              {faqs.map(([question, answer], i) => (
                <details key={question} className="faq-item reveal-3d" data-reveal="up" style={{ '--delay': `${i * 50}ms` }}>
                  <summary>{question}<span className="faq-plus" aria-hidden="true">+</span></summary><p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="cta-section reveal-3d" data-reveal="up">
          <div className="landing-container"><div className="cta-card tilt-3d">
            <div className="cta-glow" aria-hidden="true" /><h2>Ready to conduct your next exam?</h2>
            <p>Sign in with your institutional account to build exams, manage candidates, or take an assigned assessment.</p>
            <div className="hero-actions">
              <Link className="button primary hero-cta" to="/login">Open UnCooked <span aria-hidden="true">→</span></Link>
              <a className="button secondary" href="#how">Review workflow</a>
            </div>
          </div></div>
        </section>
        <LandingFooter />
      </main>
    </div>
  )
}
