import { useState } from 'react'
import { Link } from 'react-router-dom'
import { hasSession } from '../api.js'
import Brand from './Brand.jsx'

const navigation = [
  ['roles', 'Workspaces'], ['how', 'How it works'], ['demo', 'Live demo'],
  ['features', 'Features'], ['faq', 'FAQ'],
]

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className="top">
      <div className="top-inner">
        <Brand />
        <nav className="landing-nav" aria-label="Overview">
          {navigation.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
        <div id="account">
          <button className="mobile-menu-button secondary" type="button" aria-expanded={menuOpen}
            aria-controls="mobile-overview" onClick={() => setMenuOpen(open => !open)}>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
          <Link className="button primary" to={hasSession() ? '/workspace' : '/login'}>
            {hasSession() ? 'Open workspace' : 'Log in'}
          </Link>
        </div>
        {menuOpen && (
          <nav id="mobile-overview" className="mobile-overview" aria-label="Mobile overview">
            {navigation.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{label}</a>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
