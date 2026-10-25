import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { WEEKDAYS, type Habit, type HabitSchedule, type Weekday } from '../domain/habits'

export interface HabitDraft {
  name: string
  description: string
  schedule: HabitSchedule
}

interface HabitFormProps {
  initialHabit?: Habit
  onCancel: () => void
  onSave: (draft: HabitDraft) => void
}

export function HabitForm({ initialHabit, onCancel, onSave }: HabitFormProps) {
  const [name, setName] = useState(initialHabit?.name ?? '')
  const [description, setDescription] = useState(initialHabit?.description ?? '')
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(initialHabit?.schedule.frequency ?? 'daily')
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    initialHabit?.schedule.frequency === 'weekly' ? initialHabit.schedule.weekdays : [],
  )
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  function toggleWeekday(day: Weekday) {
    setWeekdays((current) => current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort((a, b) => a - b))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Give your habit a name to continue.')
      return
    }
    if (frequency === 'weekly' && weekdays.length === 0) {
      setError('Choose at least one day.')
      return
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      schedule: frequency === 'daily' ? { frequency } : { frequency, weekdays },
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="habit-form-title">
        <header className="modal-header">
          <div>
            <p className="modal-eyebrow">A SMALL PROMISE TO YOURSELF</p>
            <h2 id="habit-form-title">{initialHabit ? 'Edit habit' : 'Create a habit'}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close form" onClick={onCancel}><X size={17} /></button>
        </header>

        <form className="habit-form" onSubmit={submit} noValidate>
          <label className="form-field">
            <span>Habit name <span className="required-mark">*</span></span>
            <input
              autoFocus
              className="input-control"
              value={name}
              onChange={(event) => { setName(event.target.value); setError('') }}
              placeholder="e.g. Read for 10 minutes"
              maxLength={80}
              aria-invalid={Boolean(error && !name.trim())}
              aria-describedby={error ? 'habit-form-error' : undefined}
            />
          </label>

          <label className="form-field">
            <span>Description <span className="optional-mark">OPTIONAL</span></span>
            <textarea
              className="input-control input-textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A little context for future you"
              maxLength={240}
              rows={2}
            />
          </label>

          <fieldset className="schedule-field">
            <legend>Schedule</legend>
            <div className="schedule-options">
              <button className={`schedule-option${frequency === 'daily' ? ' is-selected' : ''}`} type="button" onClick={() => { setFrequency('daily'); setError('') }}>
                Every day
              </button>
              <button className={`schedule-option${frequency === 'weekly' ? ' is-selected' : ''}`} type="button" onClick={() => { setFrequency('weekly'); setError('') }}>
                Selected days
              </button>
            </div>
            {frequency === 'weekly' && (
              <div className="weekday-picker" aria-label="Choose weekdays">
                {WEEKDAYS.map(({ value, short, label }) => (
                  <button
                    aria-label={label}
                    aria-pressed={weekdays.includes(value)}
                    className={`weekday-button${weekdays.includes(value) ? ' is-selected' : ''}`}
                    key={value}
                    onClick={() => { toggleWeekday(value); setError('') }}
                    type="button"
                  >{short}</button>
                ))}
              </div>
            )}
          </fieldset>

          {error && <p className="form-error" id="habit-form-error" role="alert">{error}</p>}
          <footer className="modal-actions">
            <button className="button button-quiet" type="button" onClick={onCancel}>Cancel</button>
            <button className="button button-primary" type="submit">{initialHabit ? 'Save changes' : 'Create habit'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
