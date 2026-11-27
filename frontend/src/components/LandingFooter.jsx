import { Link } from 'react-router-dom'
import Brand from './Brand.jsx'

const columns = [
  ['Platform', [['#roles', 'Workspaces'], ['#how', 'How it works'], ['#demo', 'Live demo'], ['#features', 'Features']]],
  ['Access', [['/login', 'Sign in'], ['/workspace/bank', 'Question bank'], ['/workspace/create', 'New examination'], ['/workspace/import', 'Bulk import']]],
  ['Resources', [['#faq', 'FAQ'], ['/workspace/users', 'User management'], ['#features', 'Security & fairness']]],
]

export default function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="footer-watermark" aria-hidden="true">UnCooked</div>
      <div className="landing-container footer-inner">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <Brand />
            <p>Secure, distraction-free examination management for institutions, examiners, and candidates.</p>
            <span className="footer-status"><i aria-hidden="true" /> All systems operational</span>
          </div>
          {columns.map(([heading, links]) => (
            <div key={heading}>
              <h4>{heading}</h4>
              <ul>{links.map(([href, label]) => (
                <li key={label}>{href.startsWith('#') ? <a href={href}>{label}</a> : <Link to={href}>{label}</Link>}</li>
              ))}</ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} UnCooked · Web-e-Thon Secure Examination Management System.</p>
          <p>Built with server-enforced timing &amp; offline-resilient sync.</p>
        </div>
      </div>
    </footer>
  )
}
