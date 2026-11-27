import { Link } from 'react-router-dom'

export default function Brand({ to = '/', className = '' }) {
  return (
    <Link className={`brand ${className}`} to={to} aria-label="UnCooked home">
      <img className="logo" src="/reference/uc-logo.png" alt="" width="58" height="29" />
      UnCooked
    </Link>
  )
}
