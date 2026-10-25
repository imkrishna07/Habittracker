import { describe, expect, it } from 'vitest'
import { buildActivityHeatmap, getActivityForDate } from './activity'
import { changeHabitSchedule, type Habit } from './habits'

function makeHabit(
  id: string,
  createdAt: string,
  schedule: Habit['schedule'],
  extra: Partial<Habit> = {},
): Habit {
  const [year, month, day] = createdAt.split('-').map(Number)
  return {
    id,
    name: id,
    description: '',
    schedule,
    createdAt: new Date(year, month - 1, day, 12).toISOString(),
    archived: false,
    ...extra,
  }
}

describe('activity heatmap calculations', () => {
  it('uses stored completions and leaves dates with no scheduled habits neutral', () => {
    const dailyHabit = makeHabit('daily', '2026-10-20', { frequency: 'daily' })
    const wednesdayHabit = makeHabit('wed', '2026-10-19', { frequency: 'weekly', weekdays: [3] })
    const activity = getActivityForDate(
      [dailyHabit, wednesdayHabit],
      { '2026-10-21': ['daily'] },
      '2026-10-21',
    )
    expect(activity).toMatchObject({ completed: 1, scheduled: 2, ratio: 0.5, intensity: 4 })

    const inactive = getActivityForDate(
      [wednesdayHabit],
      { '2026-10-20': ['wed'] },
      '2026-10-20',
    )
    expect(inactive).toMatchObject({ completed: 0, scheduled: 0, ratio: null, intensity: 0 })
  })

  it('respects creation and archive dates for historical activity', () => {
    const habit = makeHabit('archived', '2026-10-20', { frequency: 'daily' }, { archived: true, archivedAt: '2026-10-22' })
    expect(getActivityForDate([habit], { '2026-10-21': ['archived'] }, '2026-10-19').scheduled).toBe(0)
    expect(getActivityForDate([habit], { '2026-10-21': ['archived'] }, '2026-10-21')).toMatchObject({ completed: 1, scheduled: 1 })
    expect(getActivityForDate([habit], { '2026-10-22': ['archived'] }, '2026-10-22').scheduled).toBe(0)
  })

  it('keeps the prior schedule for historical heatmap dates after an edit', () => {
    const habit = makeHabit('edited', '2026-10-19', { frequency: 'daily' })
    const completions = { '2026-10-20': ['edited'], '2026-10-21': ['edited'] }
    const edited = changeHabitSchedule(habit, { frequency: 'weekly', weekdays: [1] }, '2026-10-22')
    expect(getActivityForDate([edited], completions, '2026-10-20')).toMatchObject({ completed: 1, scheduled: 1, ratio: 1 })
    expect(getActivityForDate([edited], completions, '2026-10-22')).toMatchObject({ completed: 0, scheduled: 0, ratio: null })
    expect(completions['2026-10-20']).toEqual(['edited'])
  })

  it('builds a 365-day local-date range ending on the requested day', () => {
    const heatmap = buildActivityHeatmap([], {}, new Date(2026, 9, 25, 12))
    const cells = heatmap.weeks.flat().filter((day) => day !== null)
    expect(heatmap.endDate).toBe('2026-10-25')
    expect(cells).toHaveLength(365)
    expect(cells[0]?.date).toBe('2025-10-26')
  })

  it('starts calendar weeks on the configured weekday', () => {
    const heatmap = buildActivityHeatmap([], {}, new Date(2026, 9, 25, 12), 1)
    expect(heatmap.weeks[0][6]?.date).toBe('2025-10-26')
    expect(heatmap.weeks[1][0]?.date).toBe('2025-10-27')
  })
})
