// Shared UI components
import React from 'react'
import { Link } from 'react-router-dom'

export function Button({ variant = 'primary', className = '', disabled, children, ...props }) {
  const base =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'secondary'
      ? 'btn-secondary'
      : 'btn-link'
  return (
    <button className={`${base} ${className}`} disabled={disabled} {...props}>
      {children}
    </button>
  )
}

export function Panel({ className = '', children, ...props }) {
  return (
    <div className={`panel p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function Pill({ variant = 'default', className = '', children }) {
  const cls =
    variant === 'available'
      ? 'pill pill-available'
      : variant === 'upcoming'
      ? 'pill pill-upcoming'
      : variant === 'disabled'
      ? 'pill pill-disabled'
      : 'pill'
  return <span className={`${cls} ${className}`}>{children}</span>
}

export function FormError({ children }) {
  if (!children) return null
  return (
    <p className="text-error text-[0.94rem] mt-1" role="alert">
      {children}
    </p>
  )
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="page-heading flex gap-4 justify-between items-start mb-5">
      <div>
        <h1>{title}</h1>
        {description && <p className="text-muted">{description}</p>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  )
}

export function Breadcrumb({ back, backHref, current }) {
  return (
    <nav className="breadcrumb mb-4" aria-label="Breadcrumb">
      <Link to={backHref} className="text-ink underline underline-offset-2 mr-2">
        ← {back}
      </Link>
      <span aria-hidden="true" className="mr-2 text-muted">
        /
      </span>
      <span>{current}</span>
    </nav>
  )
}

export function Notice({ message, error }) {
  if (!message) return null
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`app-notice fixed bottom-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
        error ? 'bg-error text-white' : 'bg-ink text-white'
      }`}
    >
      {message}
    </div>
  )
}

export function useNotice() {
  const [notice, setNotice] = React.useState({ message: '', error: false })
  const timerRef = React.useRef(null)
  React.useEffect(() => () => clearTimeout(timerRef.current), [])

  function notify(message, error = false) {
    clearTimeout(timerRef.current)
    setNotice({ message, error })
    timerRef.current = setTimeout(() => setNotice({ message: '', error: false }), 5500)
  }

  return { notice, notify }
}

export function TopBar({ brand, accountContent }) {
  return (
    <header className="sticky top-0 z-10 bg-white/95 border-b border-line backdrop-blur-md">
      <div className="w-full max-w-[1160px] mx-auto px-6 min-h-[3.45rem] flex gap-4 justify-between items-center">
        {brand}
        <div className="flex items-center gap-4">{accountContent}</div>
      </div>
    </header>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-1 font-bold text-[1.1rem] tracking-tight text-ink">
      <img className="block w-14 h-7 object-contain" src="/reference/uc-logo.png" alt="" />
      UnCooked
    </div>
  )
}

export function MetadataList({ items }) {
  return (
    <dl className="metadata-list flex flex-wrap gap-y-1 gap-x-6 my-1 mb-3">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted text-[0.85rem]">{label}</dt>
          <dd className="m-0 font-semibold text-[0.92rem]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
