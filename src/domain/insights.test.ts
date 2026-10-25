import { describe, expect, it } from 'vitest'
import type { Habit, HabitData } from './habits'
import { calculateInsights } from './insights'

function habit(id: string, createdAt: string, schedule: Habit['schedule'], extra: Partial<Habit> = {}): Habit {
  return { id, name: id, description: '', schedule, createdAt: `${createdAt}T12:00:00`, archived: false, ...extra }
}

const daily: Habit['schedule'] = { frequency: 'daily' }
const weekdays: Habit['schedule'] = { frequency: 'weekly', weekdays: [1, 3, 5] }
const asOf = new Date(2026, 9, 25, 12)

describe('calculateInsights', () => {
  it('counts only scheduled, active occurrences and ignores future completions', () => {
    const data: HabitData = {
      habits: [habit('daily', '2026-10-19', daily), habit('mwf', '2026-10-19', weekdays)],
      completions: {
        '2026-10-19': ['daily', 'mwf'], '2026-10-20': ['daily'],
        '2026-10-21': ['daily', 'mwf'], '2026-10-22': ['daily'],
        '2026-10-23': ['daily', 'mwf'], '2026-10-24': ['daily'],
        '2026-10-25': ['daily'], '2026-10-26': ['daily'],
      },
    }
    const result = calculateInsights(data, '7d', asOf)
    expect(result.scheduledOccurrences).toBe(10)
    expect(result.completedOccurrences).toBe(10)
    expect(result.completionRate).toBe(1)
    expect(result.days).toHaveLength(7)
    expect(result.days[1]).toMatchObject({ date: '2026-10-20', scheduled: 1, completed: 1, rate: 1 })
    expect(result.days[6]).toMatchObject({ date: '2026-10-25', scheduled: 1, completed: 1 })
  })

  it('uses the real earliest start for all time and historical schedule changes', () => {
    const data: HabitData = {
      habits: [habit('history', '2024-12-28', daily, {
        schedule: weekdays,
        scheduleHistory: [
          { effectiveFrom: '2024-12-28', schedule: daily },
          { effectiveFrom: '2026-10-22', schedule: weekdays },
        ],
      })],
      completions: { '2024-12-28': ['history'], '2026-10-23': ['history'] },
    }
    const result = calculateInsights(data, 'all', asOf)
    expect(result.startDate).toBe('2024-12-28')
    expect(result.days[0]).toMatchObject({ date: '2024-12-28', scheduled: 1, completed: 1 })
    expect(result.days.at(-1)?.date).toBe('2026-10-25')
    expect(result.scheduledOccurrences).toBeGreaterThan(365)
  })

  it('does not count pre-start dates, archived dates, or zero-schedule days as misses', () => {
    const data: HabitData = {
      habits: [
        habit('late', '2026-10-23', daily),
        habit('archived', '2026-10-19', daily, { archived: true, archivedAt: '2026-10-22' }),
      ],
      completions: { '2026-10-23': ['late'] },
    }
    const result = calculateInsights(data, '7d', asOf)
    expect(result.days[0]).toMatchObject({ scheduled: 1, completed: 0, rate: 0 })
    expect(result.days[3]).toMatchObject({ scheduled: 0, completed: 0, rate: null })
    expect(result.days[4]).toMatchObject({ scheduled: 1, completed: 1, rate: 1 })
    expect(result.days[5]).toMatchObject({ scheduled: 1, completed: 0, rate: 0 })
    expect(result.scheduledOccurrences).toBe(6)
  })

  it('returns null percentages for empty history and only compares least consistency with enough data', () => {
    const empty = calculateInsights({ habits: [], completions: {} }, '30d', asOf)
    expect(empty.completionRate).toBeNull()
    expect(empty.scheduledOccurrences).toBe(0)
    expect(empty.days.every((day) => day.rate === null)).toBe(true)

    const one = calculateInsights({ habits: [habit('one', '2026-10-25', daily)], completions: {} }, '7d', asOf)
    expect(one.mostConsistent?.rate).toBe(0)
    expect(one.leastConsistent).toBeNull()
  })

  it('keeps local calendar dates consecutive across the spring daylight-saving change', () => {
    const data: HabitData = {
      habits: [habit('dst', '2026-03-07', daily)],
      completions: { '2026-03-07': ['dst'], '2026-03-08': ['dst'] },
    }
    const result = calculateInsights(data, '7d', new Date(2026, 2, 9, 12))
    expect(result.days).toHaveLength(7)
    expect(result.days[4]?.date).toBe('2026-03-07')
    expect(result.days[5]?.date).toBe('2026-03-08')
    expect(result.days[6]?.date).toBe('2026-03-09')
    expect(result.scheduledOccurrences).toBe(3)
    expect(result.completedOccurrences).toBe(2)
  })
})
