import { calculateHabitStreaks } from './streaks'
import {
  getHabitStartDateKey,
  getScheduleOnDate,
  isHabitActiveOnDate,
  localDateKey,
  type Habit,
  type HabitData,
} from './habits'
import type { InsightRange } from './insights'
import type { WeekStartsOn } from '../storage/preferences'

export type HabitDayStatus = 'completed' | 'missed' | 'unscheduled'

export interface HabitInsightDay {
  date: string
  status: HabitDayStatus
  scheduled: boolean
  completed: boolean
}

export interface HabitInsightWeek {
  startDate: string
  endDate: string
  scheduled: number
  completed: number
  rate: number
}

export interface HabitInsightSnapshot {
  startDate: string | null
  endDate: string
  days: HabitInsightDay[]
  completedOccurrences: number
  scheduledOccurrences: number
  missedOccurrences: number
  completionRate: number | null
  currentStreak: number
  longestStreak: number
  weeks: HabitInsightWeek[]
}

export function calculateHabitInsights(
  habit: Habit,
  completions: HabitData['completions'],
  range: InsightRange,
  asOf = new Date(),
  weekStartsOn: WeekStartsOn = 0,
): HabitInsightSnapshot {
  const endDate = localDateKey(asOf)
  const habitStart = getHabitStartDateKey(habit)
  const rangeStart = range === 'all' ? habitStart : addDays(endDate, -(Number.parseInt(range, 10) - 1))
  const startDate = habitStart && rangeStart && rangeStart > habitStart ? rangeStart : habitStart ?? rangeStart
  const archiveEnd = habit.archived && habit.archivedAt ? addDays(habit.archivedAt, -1) : endDate
  const effectiveEnd = archiveEnd < endDate ? archiveEnd : endDate
  const days = startDate && startDate <= effectiveEnd
    ? buildDays(habit, completions, startDate, effectiveEnd)
    : []
  const completedOccurrences = days.filter((day) => day.completed).length
  const scheduledOccurrences = days.filter((day) => day.scheduled).length
  const streaks = calculateHabitStreaks(habit, completions, asOf)

  return {
    startDate: days.length ? startDate : null,
    endDate: effectiveEnd,
    days,
    completedOccurrences,
    scheduledOccurrences,
    missedOccurrences: scheduledOccurrences - completedOccurrences,
    completionRate: scheduledOccurrences ? completedOccurrences / scheduledOccurrences : null,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    weeks: aggregateWeeks(days, weekStartsOn),
  }
}

function buildDays(habit: Habit, completions: HabitData['completions'], startDate: string, endDate: string): HabitInsightDay[] {
  const days: HabitInsightDay[] = []
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    if (!isHabitActiveOnDate(habit, date)) continue
    const schedule = getScheduleOnDate(habit, date)
    const weekday = localDateFromKey(date).getDay()
    const scheduled = schedule?.frequency === 'daily' || (schedule?.frequency === 'weekly' && schedule.weekdays.includes(weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6))
    const completed = Boolean(scheduled && completions[date]?.includes(habit.id))
    days.push({ date, scheduled, completed, status: completed ? 'completed' : scheduled ? 'missed' : 'unscheduled' })
  }
  return days
}

function aggregateWeeks(days: HabitInsightDay[], weekStartsOn: WeekStartsOn): HabitInsightWeek[] {
  const buckets = new Map<string, { endDate: string; scheduled: number; completed: number }>()
  for (const day of days) {
    const weekStart = startOfWeek(day.date, weekStartsOn)
    const current = buckets.get(weekStart) ?? { endDate: day.date, scheduled: 0, completed: 0 }
    current.endDate = day.date
    if (day.scheduled) {
      current.scheduled += 1
      if (day.completed) current.completed += 1
    }
    buckets.set(weekStart, current)
  }
  return [...buckets.entries()]
    .filter(([, week]) => week.scheduled > 0)
    .map(([startDate, week]) => ({ ...week, startDate, rate: week.completed / week.scheduled }))
}

function startOfWeek(dateKey: string, weekStartsOn: WeekStartsOn): string {
  const date = localDateFromKey(dateKey)
  date.setDate(date.getDate() - ((date.getDay() - weekStartsOn + 7) % 7))
  return localDateKey(date)
}

function localDateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function addDays(dateKey: string, days: number): string {
  const date = localDateFromKey(dateKey)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}
