import { describe, expect, it } from 'vitest'
import { changeHabitSchedule, type Habit, type HabitData } from './habits'
import { calculateHabitStreaks } from './streaks'

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

function records(habitId: string, dates: string[]): HabitData['completions'] {
  return Object.fromEntries(dates.map((date) => [date, [habitId]]))
}

const monWedFri: Habit['schedule'] = { frequency: 'weekly', weekdays: [1, 3, 5] }
const daily: Habit['schedule'] = { frequency: 'daily' }

describe('calculateHabitStreaks', () => {
  it('keeps a streak across unscheduled days', () => {
    const habit = makeHabit('mwf', '2026-10-19', monWedFri)
    expect(calculateHabitStreaks(habit, records('mwf', ['2026-10-19', '2026-10-21', '2026-10-23']), new Date(2026, 9, 24, 12)))
      .toEqual({ current: 3, longest: 3 })
  })

  it('breaks a streak on a missed scheduled day', () => {
    const habit = makeHabit('mwf', '2026-10-19', monWedFri)
    expect(calculateHabitStreaks(habit, records('mwf', ['2026-10-19', '2026-10-23']), new Date(2026, 9, 23, 12)))
      .toEqual({ current: 1, longest: 1 })
  })

  it('does not count an incomplete scheduled day today as a miss before the day ends', () => {
    const habit = makeHabit('daily', '2026-10-23', daily)
    expect(calculateHabitStreaks(habit, records('daily', ['2026-10-23', '2026-10-24']), new Date(2026, 9, 25, 12)))
      .toEqual({ current: 2, longest: 2 })
  })

  it('recalculates when today is unchecked and ignores future completion records', () => {
    const habit = makeHabit('daily', '2026-10-23', daily)
    const withToday = records('daily', ['2026-10-24', '2026-10-25', '2026-10-26'])
    expect(calculateHabitStreaks(habit, withToday, new Date(2026, 9, 25, 12))).toEqual({ current: 2, longest: 2 })
    delete withToday['2026-10-25']
    expect(calculateHabitStreaks(habit, withToday, new Date(2026, 9, 25, 12))).toEqual({ current: 1, longest: 1 })
  })

  it('respects the start date and schedule history after a schedule edit', () => {
    const habit = makeHabit('history', '2026-10-20', daily)
    const edited = changeHabitSchedule(habit, { frequency: 'weekly', weekdays: [1] }, '2026-10-22')
    expect(calculateHabitStreaks(edited, records('history', ['2026-10-19', '2026-10-20', '2026-10-21']), new Date(2026, 9, 21, 12)))
      .toEqual({ current: 2, longest: 2 })
    expect(edited.scheduleHistory?.map((entry) => entry.effectiveFrom)).toEqual(['2026-10-20', '2026-10-22'])
  })
})
