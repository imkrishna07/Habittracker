import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { localDateKey } from './domain/habits'
import { HABIT_STORAGE_KEY } from './storage/habitStorage'

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

beforeEach(() => window.localStorage.clear())
afterEach(() => cleanup())

describe('habit management', () => {
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
})
