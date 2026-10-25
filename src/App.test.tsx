import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { localDateKey } from './domain/habits'
import { HABIT_STORAGE_KEY } from './storage/habitStorage'
import { PREFERENCES_STORAGE_KEY } from './storage/preferences'

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

beforeEach(() => { window.localStorage.clear(); window.history.replaceState({}, '', '/') })
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/') })

describe('habit management', () => {
  it('opens an individual insight view by stable habit ID and returns to the prior page', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /create your first habit/i }))
    await user.type(screen.getByPlaceholderText(/read for 10 minutes/i), 'Read nightly')
    await user.click(screen.getByRole('button', { name: /^create habit$/i }))
    const stored = JSON.parse(window.localStorage.getItem(HABIT_STORAGE_KEY) ?? '{}')
    await user.click(screen.getByRole('button', { name: 'View details for Read nightly' }))
    expect(screen.getByRole('heading', { name: 'Read nightly' })).toBeTruthy()
    expect(window.location.hash).toBe(`#habit/${stored.habits[0].id}`)
    expect(screen.getByRole('heading', { name: 'Weekly consistency' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByRole('heading', { name: /a little, every day/i })).toBeTruthy()
  })

  it('shows a safe not-found page for an unknown habit ID', () => {
    window.history.replaceState({}, '', '#habit/unknown')
    render(<App />)
    expect(screen.getByRole('heading', { name: /habit not found/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /back to habits/i })).toBeTruthy()
  })

  it('opens the same creation form from both buttons and validates a blank name', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.click(screen.getByRole('button', { name: /new habit/i }))
    expect(screen.getByRole('dialog', { name: /create a habit/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await user.click(screen.getByRole('button', { name: /create your first habit/i }))
    await user.type(screen.getByPlaceholderText(/read for 10 minutes/i), '   ')
    await user.click(screen.getByRole('button', { name: /^create habit$/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/give your habit a name/i)
    unmount()
  })

  it('creates a habit, toggles its daily completion, updates counts, and restores it after remount', async () => {
    const user = userEvent.setup()
    const view = render(<App />)
    await user.click(screen.getByRole('button', { name: /create your first habit/i }))
    await user.type(screen.getByPlaceholderText(/read for 10 minutes/i), 'Read for ten minutes')
    await user.type(screen.getByPlaceholderText(/a little context/i), 'Before bed')
    await user.click(screen.getByRole('button', { name: /^create habit$/i }))

    expect(screen.getByText('Read for ten minutes')).toBeTruthy()
    expect(screen.getByText('0 of 1 complete')).toBeTruthy()
    const habitsNav = screen.getByRole('button', { name: /habits/i })
    expect(habitsNav.textContent).toContain('1')
    const checkbox = screen.getByRole('checkbox', { name: /mark complete: read for ten minutes/i })
    await user.click(checkbox)
    expect(screen.getByText('1 of 1 complete')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
    expect(screen.getByLabelText(/current streak 1 day, longest streak 1 day/i)).toBeTruthy()
    const completedData = JSON.parse(window.localStorage.getItem(HABIT_STORAGE_KEY) ?? '{}')
    expect(completedData.completions[localDateKey()]).toEqual([completedData.habits[0].id])

    await user.click(screen.getByRole('checkbox', { name: /mark incomplete: read for ten minutes/i }))
    expect(screen.getByText('0 of 1 complete')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getByLabelText(/current streak 0 days, longest streak 0 days/i)).toBeTruthy()
    expect(JSON.parse(window.localStorage.getItem(HABIT_STORAGE_KEY) ?? '{}').completions[localDateKey()]).toBeUndefined()

    await user.click(screen.getByRole('checkbox', { name: /mark complete: read for ten minutes/i }))

    view.unmount()
    render(<App />)
    expect(screen.getByText('Read for ten minutes')).toBeTruthy()
    expect(screen.getByText('Before bed')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /mark incomplete: read for ten minutes/i }).getAttribute('aria-checked')).toBe('true')
  })

  it('edits a habit, omits it from today when unscheduled, and deletes it after confirmation', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /new habit/i }))
    await user.type(screen.getByPlaceholderText(/read for 10 minutes/i), 'Morning walk')
    await user.click(screen.getByRole('button', { name: /^create habit$/i }))
    await user.click(within(screen.getByRole('navigation', { name: /pages/i })).getByRole('button', { name: /habits/i }))

    await user.click(screen.getByRole('button', { name: /edit morning walk/i }))
    const dialog = screen.getByRole('dialog', { name: /edit habit/i })
    const nameInput = within(dialog).getByPlaceholderText(/read for 10 minutes/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Evening walk')
    await user.type(within(dialog).getByPlaceholderText(/a little context/i), 'A relaxed loop')
    await user.click(within(dialog).getByRole('button', { name: /selected days/i }))
    const todayName = weekdayNames[new Date().getDay()]
    const otherDay = weekdayNames.find((day) => day !== todayName)!
    await user.click(within(dialog).getByRole('button', { name: otherDay }))
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }))

    expect(screen.getByText('Evening walk')).toBeTruthy()
    expect(screen.getByText(/a relaxed loop/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^today$/i }))
    expect(screen.queryByRole('checkbox', { name: /evening walk/i })).toBeNull()
    expect(screen.getByText(/nothing is scheduled for today/i)).toBeTruthy()

    await user.click(within(screen.getByRole('navigation', { name: /pages/i })).getByRole('button', { name: /habits/i }))
    await user.click(screen.getByRole('button', { name: /delete evening walk/i }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /delete habit/i }))
    expect(screen.queryByText('Evening walk')).toBeNull()
    expect(screen.getByRole('button', { name: /habits/i }).textContent).toContain('0')
  })

  it('does not crash on malformed stored data and starts in a recoverable empty state', () => {
    window.localStorage.setItem(HABIT_STORAGE_KEY, '{not json')
    render(<App />)
    expect(screen.getByText(/some saved data could not be read/i)).toBeTruthy()
    expect(screen.getByText(/your day starts here/i)).toBeTruthy()
  })

  it('adds Insights navigation and updates metrics immediately when a completion changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /create your first habit/i }))
    await user.type(screen.getByPlaceholderText(/read for 10 minutes/i), 'Daily reading')
    await user.click(screen.getByRole('button', { name: /^create habit$/i }))

    await user.click(screen.getByRole('button', { name: /insights/i }))
    expect(screen.getByRole('heading', { name: 'Insights' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '30 days' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('0 of 1 scheduled')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /^today$/i }))
    await user.click(screen.getByRole('checkbox', { name: /mark complete: daily reading/i }))
    await user.click(screen.getByRole('button', { name: /insights/i }))
    expect(screen.getByText('1 of 1 scheduled')).toBeTruthy()
    expect(screen.getByLabelText('Daily reading completion rate').getAttribute('aria-valuenow')).toBe('100')
    await user.click(screen.getByRole('button', { name: '7 days' }))
    expect(screen.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('saves appearance and week-start preferences across a refresh', async () => {
    const user = userEvent.setup()
    const view = render(<App />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    await user.click(screen.getByRole('button', { name: 'Light' }))
    await user.selectOptions(screen.getByLabelText(/first day of the week/i), '1')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}')).toEqual({ theme: 'light', weekStartsOn: 1 })

    view.unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText(/first day of the week/i) as HTMLSelectElement).value).toBe('1')
  })

  it('requires an explicit confirmation before clearing local data', async () => {
    const user = userEvent.setup()
    const stored = { habits: [], completions: { '2026-10-24': ['example'] } }
    window.localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(stored))
    render(<App />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    await user.click(screen.getByRole('button', { name: /clear data/i }))
    expect(screen.getByRole('alertdialog', { name: /clear all local data/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(window.localStorage.getItem(HABIT_STORAGE_KEY)).toBe(JSON.stringify(stored))
    await user.click(screen.getByRole('button', { name: /clear data/i }))
    await user.click(screen.getByRole('alertdialog').querySelector('button.button-danger')!)
    expect(window.localStorage.getItem(HABIT_STORAGE_KEY)).toBeNull()
  })

  it('previews a valid backup and leaves existing data untouched when restore is cancelled', async () => {
    const user = userEvent.setup()
    const current = { habits: [], completions: {} }
    window.localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(current))
    render(<App />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    const backup = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: { habits: [{ id: 'restored', name: 'Restored', description: '', schedule: { frequency: 'daily' }, createdAt: new Date().toISOString(), archived: false }], completions: { [localDateKey()]: ['restored'] } },
      preferences: { theme: 'dark', weekStartsOn: 0 },
    }
    const file = new File([JSON.stringify(backup)], 'still-backup.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText(/choose still backup json file/i), file)
    expect(await screen.findByRole('region', { name: /backup preview/i })).toBeTruthy()
    expect(screen.getByRole('region', { name: /backup preview/i }).textContent).toContain('1 habit and 1 completion record')
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(window.localStorage.getItem(HABIT_STORAGE_KEY)).toBe(JSON.stringify(current))
    expect(screen.queryByRole('region', { name: /backup preview/i })).toBeNull()

    await user.upload(screen.getByLabelText(/choose still backup json file/i), file)
    await screen.findByRole('region', { name: /backup preview/i })
    await user.click(screen.getByRole('button', { name: /replace with this backup/i }))
    await user.click(screen.getByRole('button', { name: /^today$/i }))
    expect(screen.getByText('Restored')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /mark incomplete: restored/i }).getAttribute('aria-checked')).toBe('true')
  })

  it('archives and restores a habit without discarding its completion history', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /create your first habit/i }))
    await user.type(screen.getByPlaceholderText(/read for 10 minutes/i), 'Keep history')
    await user.click(screen.getByRole('button', { name: /^create habit$/i }))
    await user.click(screen.getByRole('checkbox', { name: /mark complete: keep history/i }))
    await user.click(screen.getByRole('button', { name: /habits, 1 active/i }))
    await user.click(screen.getByRole('button', { name: /archive keep history/i }))
    expect(screen.getByRole('button', { name: /habits, 0 active/i })).toBeTruthy()
    expect(screen.getByRole('region', { name: /archived habits/i }).textContent).toContain('Keep history')
    const archivedData = JSON.parse(window.localStorage.getItem(HABIT_STORAGE_KEY) ?? '{}')
    expect(archivedData.completions[localDateKey()]).toEqual([archivedData.habits[0].id])
    expect(archivedData.habits[0].archivedAt).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /restore keep history/i }))
    await user.click(screen.getByRole('button', { name: /^today$/i }))
    expect(screen.getByRole('checkbox', { name: /mark incomplete: keep history/i }).getAttribute('aria-checked')).toBe('true')
  })

  it('closes the habit form with Escape for keyboard users', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /new habit/i }))
    expect(screen.getByRole('dialog', { name: /create a habit/i })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /create a habit/i })).toBeNull()
  })

  it('requires at least one selected weekday for a weekly habit', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /create your first habit/i }))
    await user.type(screen.getByPlaceholderText(/read for 10 minutes/i), 'Weekly habit')
    await user.click(screen.getByRole('button', { name: /selected days/i }))
    await user.click(screen.getByRole('button', { name: /^create habit$/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/choose at least one day/i)
    await user.click(screen.getByRole('button', { name: 'Monday' }))
    await user.click(screen.getByRole('button', { name: /^create habit$/i }))
    const saved = JSON.parse(window.localStorage.getItem(HABIT_STORAGE_KEY) ?? '{}')
    expect(saved.habits[0].schedule).toEqual({ frequency: 'weekly', weekdays: [1] })
  })
})
