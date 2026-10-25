import { useEffect, useRef, useState } from 'react'
import type { HabitData } from '../domain/habits'
import { downloadBackup, validateBackup, type StillBackup } from '../storage/backup'
import type { UserPreferences } from '../storage/preferences'

const weekDays = [
  { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
] as const

export function SettingsPage({
  data,
  preferences,
  onPreferencesChange,
  onRestore,
  onClear,
}: {
  data: HabitData
  preferences: UserPreferences
  onPreferencesChange: (preferences: UserPreferences) => void
  onRestore: (backup: StillBackup) => void
  onClear: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ReturnType<typeof validateBackup> | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time zone'

  useEffect(() => {
    if (!confirmClear) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setConfirmClear(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmClear])

  function changePreferences(next: UserPreferences) {
    try {
      onPreferencesChange(next)
      setMessage({ type: 'success', text: 'Preferences saved.' })
    } catch {
      setMessage({ type: 'error', text: 'Preferences could not be saved in this browser.' })
    }
  }

  function exportData() {
    try {
      downloadBackup(data, preferences)
      setMessage({ type: 'success', text: 'Your Still backup was downloaded.' })
    } catch {
      setMessage({ type: 'error', text: 'The backup could not be downloaded. Check your browser storage and try again.' })
    }
  }

  async function inspectFile(file?: File) {
    setMessage(null)
    setPreview(null)
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await readFile(file))
      setPreview(validateBackup(parsed))
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'This file could not be read as a Still backup.' })
    }
  }

  function restore() {
    if (!preview) return
    try {
      onRestore(preview.backup)
      setMessage({ type: 'success', text: 'Backup restored. Your habits and preferences are up to date.' })
      setPreview(null)
      if (fileInput.current) fileInput.current.value = ''
    } catch {
      setMessage({ type: 'error', text: 'The backup could not be saved. Your existing data was kept.' })
    }
  }

  function clear() {
    try {
      onClear()
      setConfirmClear(false)
      setPreview(null)
      setMessage({ type: 'success', text: 'Local Still data was cleared.' })
    } catch {
      setMessage({ type: 'error', text: 'Local data could not be cleared.' })
    }
  }

  return (
    <>
      <section className="welcome-section settings-heading" aria-labelledby="page-title">
        <p className="eyebrow">YOUR SPACE</p><h1 id="page-title">Settings</h1>
        <p className="welcome-copy">A few choices for how Still works for you.</p>
      </section>
      <div className="settings-content">
        <section className="settings-section" aria-labelledby="appearance-title">
          <header><h2 id="appearance-title">Appearance</h2><p>Choose how Still looks on this device.</p></header>
          <div className="setting-control theme-options" role="group" aria-label="Appearance theme">
            {(['light', 'dark', 'system'] as const).map((theme) => <button key={theme} type="button"
              className={`insight-range-button${preferences.theme === theme ? ' is-selected' : ''}`}
              aria-pressed={preferences.theme === theme}
              onClick={() => changePreferences({ ...preferences, theme })}>{theme[0].toUpperCase() + theme.slice(1)}</button>)}
          </div>
        </section>

        <section className="settings-section" aria-labelledby="preferences-title">
          <header><h2 id="preferences-title">Preferences</h2><p>Set the calendar convention for your activity view.</p></header>
          <label className="setting-choice" htmlFor="week-start"><span>First day of the week</span>
            <select id="week-start" className="settings-select" value={preferences.weekStartsOn} onChange={(event) => changePreferences({ ...preferences, weekStartsOn: Number(event.target.value) as UserPreferences['weekStartsOn'] })}>
              {weekDays.map((day) => <option value={day.value} key={day.value}>{day.label}</option>)}
            </select>
          </label>
          <div className="setting-choice"><span>Time zone</span><span className="setting-readonly">{timeZone}</span></div>
        </section>

        <section className="settings-section" aria-labelledby="data-title">
          <header><h2 id="data-title">Data management</h2><p>Your data stays in this browser. Backups are saved only when you download them.</p></header>
          <div className="settings-action-row">
            <div><strong>Export a backup</strong><span>Habits, schedules, history, and preferences in versioned JSON.</span></div>
            <button className="button button-secondary" type="button" onClick={exportData}>Download JSON</button>
          </div>
          <div className="settings-action-row">
            <div><strong>Restore a backup</strong><span>Review its contents before replacing current data.</span></div>
            <button className="button button-secondary" type="button" onClick={() => fileInput.current?.click()}>Choose file</button>
            <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" aria-label="Choose Still backup JSON file" onChange={(event) => void inspectFile(event.currentTarget.files?.[0])} />
          </div>
          {preview && <div className="backup-preview" role="region" aria-label="Backup preview">
            <p>This backup contains <strong>{preview.habitCount}</strong> {preview.habitCount === 1 ? 'habit' : 'habits'} and <strong>{preview.completionRecordCount}</strong> {preview.completionRecordCount === 1 ? 'completion record' : 'completion records'}.</p>
            <p>Restoring replaces all current habits, completion history, and preferences.</p>
            <div className="settings-actions"><button className="button button-quiet" type="button" onClick={() => { setPreview(null); if (fileInput.current) fileInput.current.value = '' }}>Cancel</button>
              <button className="button button-primary" type="button" onClick={restore}>Replace with this backup</button></div>
          </div>}
          <div className="settings-action-row settings-destructive-row">
            <div><strong>Clear local data</strong><span>Remove all habits, completions, and saved preferences from this browser.</span></div>
            <button className="button button-quiet" type="button" onClick={() => setConfirmClear(true)}>Clear data</button>
          </div>
          {message && <p className={`settings-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
        </section>
      </div>

      {confirmClear && <div className="modal-backdrop" role="presentation"><section className="modal-panel confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="clear-title" aria-describedby="clear-copy">
        <header className="modal-header"><div><p className="modal-eyebrow">DATA MANAGEMENT</p><h2 id="clear-title">Clear all local data?</h2></div></header>
        <p className="confirm-copy" id="clear-copy">This permanently removes {data.habits.length} {data.habits.length === 1 ? 'habit' : 'habits'} and all completion history from this browser. Download a backup first if you may want to restore it.</p>
        <div className="modal-actions"><button className="button button-quiet" type="button" autoFocus onClick={() => setConfirmClear(false)}>Cancel</button><button className="button button-danger" type="button" onClick={clear}>Clear local data</button></div>
      </section></div>}
    </>
  )
}

function readFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The selected file could not be read.'))
    reader.onerror = () => reject(new Error('The selected file could not be read.'))
    reader.readAsText(file)
  })
}
