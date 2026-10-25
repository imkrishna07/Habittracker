import {
  getScheduleOnDate,
  isHabitActiveOnDate,
  localDateKey,
  type Habit,
  type HabitData,
} from './habits'
import type { WeekStartsOn } from '../storage/preferences'

export interface ActivityDay {
  date: string
  completed: number
  scheduled: number
  ratio: number | null
  intensity: 0 | 1 | 2 | 3 | 4 | 5
}

export interface ActivityHeatmap {
  weeks: (ActivityDay | null)[][]
  startDate: string
  endDate: string
}

const DAY_COUNT = 365

export function buildActivityHeatmap(
  habits: Habit[],
  completions: HabitData['completions'],
  endDate = new Date(),
  weekStartsOn: WeekStartsOn = 0,
): ActivityHeatmap {
  const endKey = localDateKey(endDate)
  const startKey = addDaysToKey(endKey, -(DAY_COUNT - 1))
  const startDay = dateFromKey(startKey).getDay()
  const leadingDays = (startDay - weekStartsOn + 7) % 7
  const gridStart = addDaysToKey(startKey, -leadingDays)
  const weekCount = Math.ceil((leadingDays + DAY_COUNT) / 7)
  const weeks: (ActivityDay | null)[][] = []

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const week: (ActivityDay | null)[] = []
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = addDaysToKey(gridStart, weekIndex * 7 + weekday)
      week.push(date < startKey || date > endKey ? null : getActivityForDate(habits, completions, date))
    }
    weeks.push(week)
  }

  return { weeks, startDate: startKey, endDate: endKey }
}

export function getActivityForDate(
  habits: Habit[],
  completions: HabitData['completions'],
  date: string,
): ActivityDay {
  const activeOnDate = habits.filter((habit) => isHabitActiveOnDate(habit, date))
  const scheduledHabits = activeOnDate.filter((habit) => {
    const schedule = getScheduleOnDate(habit, date)
    return schedule ? isDateScheduled(schedule, date) : false
  })
  const completedSet = new Set(completions[date] ?? [])
  const completed = scheduledHabits.filter((habit) => completedSet.has(habit.id)).length
  const scheduled = scheduledHabits.length
  const ratio = scheduled === 0 ? null : completed / scheduled

  return { date, completed, scheduled, ratio, intensity: getIntensity(ratio) }
}

function getIntensity(ratio: number | null): ActivityDay['intensity'] {
  if (ratio === null) return 0
  if (ratio === 0) return 1
  if (ratio < 0.25) return 2
  if (ratio < 0.5) return 3
  if (ratio < 1) return 4
  return 5
}

function isDateScheduled(schedule: NonNullable<ReturnType<typeof getScheduleOnDate>>, date: string): boolean {
  if (schedule.frequency === 'daily') return true
  return schedule.weekdays.includes(dateFromKey(date).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6)
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function addDaysToKey(key: string, amount: number): string {
  const date = dateFromKey(key)
  date.setDate(date.getDate() + amount)
  return localDateKey(date)
}
