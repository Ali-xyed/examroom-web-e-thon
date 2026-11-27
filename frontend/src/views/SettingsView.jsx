import { useState } from 'react'
import { PageHeader, Panel, Button, Breadcrumb } from '../components/ui.jsx'
import { readLocal, writeLocal } from '../localStore.js'

const roles = { administrator: 'Administrator', examiner: 'Examiner', candidate: 'Candidate' }

export default function SettingsView({ profile, notify }) {
  const [prefs, setPrefs] = useState(() => readLocal('preferences', { size: '16', layout: 'side' }))

  function updatePref(key, value) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    writeLocal('preferences', next)
    notify('Workspace preferences saved.')
  }

  function clearLocalCache() {
    if (!window.confirm('Clear locally cached scratchpads and preferences on this browser?')) return
    const keys = Object.keys(localStorage).filter(k => k.startsWith('uncooked-'))
    keys.forEach(k => localStorage.removeItem(k))
    setPrefs({ size: '16', layout: 'side' })
    notify('Local browser cache cleared.')
  }

  return (
    <div className="space-y-6">
      <Breadcrumb back="Back to Examinations" backHref="/workspace" current="Settings" />
      <PageHeader title="Settings & preferences" description="Manage your profile summary, display preferences, and browser storage." />

      <Panel>
        <h2 className="mb-3">Account profile</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-muted text-xs uppercase tracking-wide mb-1">Full name</dt>
            <dd className="font-semibold">{profile.name}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs uppercase tracking-wide mb-1">Role</dt>
            <dd className="font-semibold">{roles[profile.role]}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs uppercase tracking-wide mb-1">Account status</dt>
            <dd className="font-semibold text-[#336548]">Active</dd>
          </div>
        </dl>
      </Panel>

      <Panel>
        <h2 className="mb-3">Exam workspace preferences</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="form-label text-sm">
            Default question text size
            <select className="form-select" value={prefs.size} onChange={e => updatePref('size', e.target.value)}>
              <option value="16">Standard (16px)</option>
              <option value="20">Large (20px)</option>
              <option value="24">Extra large (24px)</option>
            </select>
          </label>
          <label className="form-label text-sm">
            Question navigator layout
            <select className="form-select" value={prefs.layout} onChange={e => updatePref('layout', e.target.value)}>
              <option value="side">Side navigator</option>
              <option value="stack">Stacked navigator</option>
            </select>
          </label>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-2">Browser storage &amp; recovery</h2>
        <p className="text-sm text-muted mb-4">
          UnCooked stores workspace preferences and offline scratchpads locally on this browser so you do not lose work during network drops.
        </p>
        <Button variant="secondary" onClick={clearLocalCache}>Clear local browser cache</Button>
      </Panel>
    </div>
  )
}
