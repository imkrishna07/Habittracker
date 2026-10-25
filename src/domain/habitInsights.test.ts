import { describe, expect, it } from 'vitest'
import type { Habit, HabitData } from './habits'
import { calculateHabitInsights } from './habitInsights'
import { calculateHabitStreaks } from './streaks'

function habit(id: string, createdAt: string, schedule: Habit['schedule'], extra: Partial<Habit> = {}): Habit {
  const [year, month, day] = createdAt.split('-').map(Number)
  return { id, name: id, description: '', schedule, createdAt: new Date(year, month - 1, day, 12).toISOString(), archived: false, ...extra }
}

describe('calculateHabitInsights', () => {
  const today = new Date(2026, 9, 25, 12)

  it('counts only scheduled occurrences after the start date and omits future records', () => {
    const walking = habit('walk', '2026-10-20', { frequency: 'weekly', weekdays: [1, 3, 5] })
    const completions: HabitData['completions'] = {
      '2026-10-19': ['walk'], '2026-10-20': ['walk'], '2026-10-21': ['walk'],
      '2026-10-23': ['walk'], '2026-10-26': ['walk'],
    }
    const result = calculateHabitInsights(walking, completions, '7d', today, 1)
    expect(result.scheduledOccurrences).toBe(2)
    expect(result.completedOccurrences).toBe(2)
    expect(result.completionRate).toBe(1)
    expect(result.days.find((day) => day.date === '2026-10-22')?.status).toBe('unscheduled')
    expect(result.days.some((day) => day.date === '2026-10-26')).toBe(false)
  })

  it('uses historical schedule, archive dates, and configured week starts', () => {
    const daily = habit('history', '2026-10-19', { frequency: 'weekly', weekdays: [1] }, {
      archived: true,
      archivedAt: '2026-10-23',
      schedule: { frequency: 'weekly', weekdays: [5] },
      scheduleHistory: [
        { effectiveFrom: '2026-10-19', schedule: { frequency: 'weekly', weekdays: [1] } },
        { effectiveFrom: '2026-10-22', schedule: { frequency: 'weekly', weekdays: [5] } },
      ],
    })
    const result = calculateHabitInsights(daily, { '2026-10-19': ['history'] }, 'all', today, 1)
    expect(result.days.map((day) => day.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'])
    expect(result.scheduledOccurrences).toBe(1)
    expect(result.completedOccurrences).toBe(1)
    expect(result.weeks).toEqual([{ startDate: '2026-10-19', endDate: '2026-10-22', scheduled: 1, completed: 1, rate: 1 }])
  })

  it('returns a null rate for a period without scheduled occurrences', () => {
    const mondayOnly = habit('monday', '2026-10-20', { frequency: 'weekly', weekdays: [1] })
    const result = calculateHabitInsights(mondayOnly, {}, '7d', today)
    expect(result.scheduledOccurrences).toBe(0)
    expect(result.completionRate).toBeNull()
    expect(result.weeks).toEqual([])
  })

  it('uses the selected range for distinct habit schedules and reuses the existing streak result', () => {
    const daily = habit('daily', '2026-09-01', { frequency: 'daily' })
    const monday = habit('monday', '2026-09-01', { frequency: 'weekly', weekdays: [1] })
    const completions: HabitData['completions'] = {
      '2026-10-19': ['daily', 'monday'],
      '2026-10-20': ['daily'],
      '2026-10-21': ['daily'],
      '2026-10-22': ['daily'],
      '2026-10-23': ['daily'],
    }
    const dailyWeek = calculateHabitInsights(daily, completions, '7d', today)
    const mondayWeek = calculateHabitInsights(monday, completions, '7d', today)
    const dailyAll = calculateHabitInsights(daily, completions, 'all', today)
    expect(dailyWeek.scheduledOccurrences).toBe(7)
    expect(mondayWeek.scheduledOccurrences).toBe(1)
    expect(dailyWeek.completionRate).not.toBe(mondayWeek.completionRate)
    expect(dailyAll.scheduledOccurrences).toBeGreaterThan(dailyWeek.scheduledOccurrences)
    expect(dailyWeek.currentStreak).toBe(calculateHabitStreaks(daily, completions, today).current)
    expect(dailyWeek.longestStreak).toBe(calculateHabitStreaks(daily, completions, today).longest)
  })
})
