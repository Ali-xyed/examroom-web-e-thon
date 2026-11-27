import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductPreview from '../components/ProductPreview.jsx'
import PublicHeader from '../components/PublicHeader.jsx'
import LandingFooter from '../components/LandingFooter.jsx'
import useLandingEffects from '../hooks/useLandingEffects.js'
import { steps, roleCards, capabilities, trustedLogos, faqs } from '../landingContent.js'
import '../styles/public-site.css'

const avatars = ['pile-1.webp', 'pile-2.webp', 'pile-3.webp', 'pile-4.webp', 'folder-face.svg', 'glasses-face.svg', 'squiggle-face.svg']

export default function LandingPage() {
  const pageRef = useRef(null)
  const [activeCap, setActiveCap] = useState(0)
  useLandingEffects(pageRef)

  return (
    <div className="public-site" data-view="landing" ref={pageRef}>
      <a className="skip" href="#main">Skip to content</a>
      <PublicHeader />
      <main id="main" tabIndex={-1}>
        {/* Centered Hero matching screenshot */}
        <section className="landing-hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-copy">
            <div className="hero-avatars reveal-3d" data-reveal="up" aria-hidden="true">
              {avatars.map(name => <img key={name} src={`/reference/${name}`} alt="" width="56" height="56" />)}
            </div>
            <h1 className="reveal-3d" data-reveal="up">
              <span>Where institutions</span>
              <span className="hero-second">run <span className="hero-highlight"><i aria-hidden="true" />online exams</span></span>
            </h1>
            <p className="hero-description reveal-3d" data-reveal="up">
              Create scheduled exams, enroll candidates, and run timed assessments with automatic answer saving.
            </p>
            <div className="hero-actions reveal-3d" data-reveal="up">
              <Link className="button primary hero-cta" to="/login">Sign in</Link>
              <a className="button secondary" href="#demo">See the demo</a>
            </div>
            <p className="hero-note reveal-3d" data-reveal="up">Web-e-Thon · Accounts are created by your administrator</p>
          </div>
          <ProductPreview />
        </section>

        {/* Infinite-scrolling Trusted By Logo Marquee */}
        <section className="trusted-section reveal-3d" data-reveal="up" aria-label="Trusted institutions">
          <p>Trusted by leading academic teams &amp; examination boards</p>
          <div className="marquee-wrap">
            <div className="marquee-track">
              {[...trustedLogos, ...trustedLogos].map((name, idx) => (
                <span key={`${name}-${idx}`} className="marquee-item">
                  <i aria-hidden="true" />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Workspaces (#roles) */}
        <section className="roles-section" id="roles">
          <div className="landing-container">
            <div className="section-head center reveal-3d" data-reveal="up">
              <div className="section-label">Workspaces</div>
              <h2>One platform. Every role covered.</h2>
              <p className="section-intro">Tailored interfaces for examiners, candidates, and administrators, each with clear controls and zero clutter.</p>
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

        {/* How It Works (#how) */}
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

        {/* Interactive Revealing Capabilities (#features) */}
        <section className="feature-section" id="features">
          <div className="landing-container">
            <div className="section-head center reveal-3d" data-reveal="up">
              <div className="section-label">Capabilities</div>
              <h2>Built like a real-world exam engine</h2>
              <p className="section-intro">Click or hover any capability card to reveal its live workflow details.</p>
            </div>
            <div className="cap-grid">
              {capabilities.map(([meta, title, summary, detail, chips], i) => {
                const isOpen = activeCap === i
                return (
                  <article
                    key={meta}
                    className={`cap-card tilt-3d reveal-3d ${isOpen ? 'is-open' : ''}`}
                    data-reveal="up"
                    style={{ '--delay': `${i * 60}ms` }}
                    onMouseEnter={() => setActiveCap(i)}
                    onClick={() => setActiveCap(i)}
                  >
                    <div className="cap-card-head">
                      <span className="bento-meta">{meta}</span>
                      <span className="cap-indicator" aria-hidden="true">{isOpen ? 'Active' : 'Explore'}</span>
                    </div>
                    <h3>{title}</h3>
                    <p>{summary}</p>
                    <div className="cap-reveal">
                      <p className="cap-detail">{detail}</p>
                      <div className="bento-chips">
                        {chips.map(chip => <span key={chip}>✓ {chip}</span>)}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* FAQ (#faq) */}
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

        {/* Final CTA */}
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
