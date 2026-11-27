import { Link, useLocation } from 'react-router-dom'
import Brand from './Brand.jsx'

function Icon({ name }) {
  const props = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'shrink-0' }
  switch (name) {
    case 'exams': return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h6M7 16h4" /></svg>
    case 'bank': return <svg {...props}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
    case 'create': return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
    case 'import': return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
    case 'users': return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
    case 'home': return <svg {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    case 'logout': return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
    case 'collapse': return <svg {...props}><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>
    case 'expand': return <svg {...props}><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></svg>
    default: return null
  }
}

const roles = { administrator: 'Administrator', examiner: 'Examiner', candidate: 'Candidate' }

export default function WorkspaceSidebar({ profile, online, collapsed, onToggleCollapse, mobileOpen, onCloseMobile, onSignOut }) {
  const { pathname } = useLocation()

  const primaryNav =
    profile.role === 'examiner'
      ? [
          { to: '/workspace', label: 'Examinations', icon: 'exams', exact: true },
          { to: '/workspace/bank', label: 'Question bank', icon: 'bank' },
          { to: '/workspace/create', label: 'New examination', icon: 'create' },
          { to: '/workspace/import', label: 'Bulk import', icon: 'import' },
        ]
      : profile.role === 'administrator'
      ? [
          { to: '/workspace', label: 'Overview', icon: 'exams', exact: true },
          { to: '/workspace/users', label: 'Manage users', icon: 'users' },
          { to: '/workspace/import', label: 'Bulk import', icon: 'import' },
        ]
      : [{ to: '/workspace', label: 'My examinations', icon: 'exams', exact: true }]

  function isActive(item) {
    if (item.exact) {
      return pathname === '/workspace' || (pathname.startsWith('/workspace/') && !['/workspace/bank', '/workspace/create', '/workspace/import', '/workspace/users', '/workspace/settings'].some(p => pathname.startsWith(p)))
    }
    return pathname.startsWith(item.to)
  }

  const sidebarContent = (isMobile = false) => {
    const isCollapsed = !isMobile && collapsed
    return (
      <div className="flex h-full flex-col justify-between bg-white border-r border-line">
        <div>
          {/* Brand Header */}
          <div className={`flex h-16 items-center border-b border-line ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
            {!isCollapsed ? (
              <Brand to="/workspace" />
            ) : (
              <Link to="/workspace" aria-label="UnCooked home" className="font-extrabold text-sm tracking-tight text-ink">
                UC
              </Link>
            )}
            {isMobile && (
              <button type="button" onClick={onCloseMobile} className="btn-secondary px-2 py-1 text-xs" aria-label="Close navigation">
                ×
              </button>
            )}
          </div>

          {/* Primary Navigation */}
          <div className="px-3 py-4">
            {!isCollapsed && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Workspace</p>
            )}
            <nav className="flex flex-col gap-1" aria-label="Workspace navigation">
              {primaryNav.map(item => {
                const active = isActive(item)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={isMobile ? onCloseMobile : undefined}
                    title={isCollapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                      active ? 'bg-ink text-white' : 'text-muted hover:bg-soft hover:text-ink'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon name={item.icon} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </nav>

            {/* General / System */}
            {!isCollapsed && (
              <p className="px-3 mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">General</p>
            )}
            <nav className={`flex flex-col gap-1 ${isCollapsed ? 'mt-4 pt-4 border-t border-line' : ''}`} aria-label="General navigation">
              <Link
                to="/workspace/settings"
                onClick={isMobile ? onCloseMobile : undefined}
                title={isCollapsed ? 'Settings' : undefined}
                aria-current={pathname.startsWith('/workspace/settings') ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  pathname.startsWith('/workspace/settings') ? 'bg-ink text-white' : 'text-muted hover:bg-soft hover:text-ink'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon name="settings" />
                {!isCollapsed && <span className="truncate">Settings</span>}
              </Link>
              <Link
                to="/"
                onClick={isMobile ? onCloseMobile : undefined}
                title={isCollapsed ? 'Public site' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-muted hover:bg-soft hover:text-ink transition-colors ${
                  isCollapsed ? 'justify-center px-0' : ''
                }`}
              >
                <Icon name="home" />
                {!isCollapsed && <span className="truncate">Public site</span>}
              </Link>
            </nav>
          </div>
        </div>

        {/* Footer: Connection, Profile, Sign Out, Collapse */}
        <div className="border-t border-line p-3 space-y-2">
          <div className={`flex items-center gap-2 px-2 py-1 text-xs text-muted ${isCollapsed ? 'justify-center' : ''}`} role="status">
            <span className={`conn-dot ${online ? 'online' : 'offline'}`} aria-hidden="true" />
            {!isCollapsed && <span>{online ? 'Connected' : 'Offline'}</span>}
          </div>

          <div className={`flex items-center gap-2.5 rounded-xl bg-surface p-2 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-lg bg-ink text-white text-xs font-bold grid place-items-center shrink-0" aria-hidden="true">
              {profile.name.trim().slice(0, 1).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-xs font-semibold text-ink truncate">{profile.name}</div>
                <div className="text-[11px] text-muted truncate">{roles[profile.role]}</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onSignOut}
            title={isCollapsed ? 'Sign out' : undefined}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-error hover:bg-[#fdebec] transition-colors ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <Icon name="logout" />
            {!isCollapsed && <span>Sign out</span>}
          </button>

          {!isMobile && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-muted hover:bg-soft hover:text-ink transition-colors ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <Icon name={collapsed ? 'expand' : 'collapse'} />
              {!isCollapsed && <span>Collapse</span>}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop collapsible sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen transition-all duration-200 ${
          collapsed ? 'w-[72px]' : 'w-[248px]'
        }`}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={onCloseMobile} aria-hidden="true" />
          <aside className="relative z-10 w-[260px] max-w-[85vw] h-full shadow-xl">
            {sidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  )
}
