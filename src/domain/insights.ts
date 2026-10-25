import { calculateHabitStreaks } from './streaks'
import {
  getHabitStartDateKey,
  getScheduleOnDate,
  isHabitActiveOnDate,
  localDateKey,
  type Habit,
  type HabitData,
} from './habits'

export type InsightRange = '7d' | '30d' | '90d' | 'all'

export interface DailyInsight {
  date: string
  completed: number
  scheduled: number
  rate: number | null
}

export interface HabitConsistency {
  habit: Habit
  completed: number
  scheduled: number
  rate: number | null
}

export interface InsightsSnapshot {
  startDate: string | null
  endDate: string
  days: DailyInsight[]
  completedOccurrences: number
  scheduledOccurrences: number
  completionRate: number | null
  bestCurrentStreak: number
  longestStreak: number
  habits: HabitConsistency[]
  mostConsistent: HabitConsistency | null
  leastConsistent: HabitConsistency | null
}

const MIN_COMPARISON_OCCURRENCES = 3

export function calculateInsights(
  data: HabitData,
  range: InsightRange,
  asOf = new Date(),
): InsightsSnapshot {
  const endDate = localDateKey(asOf)
  const startDate = getRangeStart(range, data.habits, endDate)
  const days = startDate && startDate <= endDate
    ? buildDailyInsights(data.habits, data.completions, startDate, endDate)
    : []
  const scheduledOccurrences = days.reduce((sum, day) => sum + day.scheduled, 0)
  const completedOccurrences = days.reduce((sum, day) => sum + day.completed, 0)
  const completionRate = scheduledOccurrences ? completedOccurrences / scheduledOccurrences : null

  const activeHabits = data.habits.filter((habit) => !habit.archived)
  const habits = activeHabits.map((habit) => {
    const metrics = countHabitOccurrences(habit, data.completions, days)
    return { habit, ...metrics, rate: metrics.scheduled ? metrics.completed / metrics.scheduled : null }
  }).sort(compareConsistency)

  const comparableHabits = habits.filter((habit) => habit.scheduled >= MIN_COMPARISON_OCCURRENCES)
  const currentStreaks = activeHabits.map((habit) => calculateHabitStreaks(habit, data.completions, asOf))

  return {
    startDate,
    endDate,
    days,
    completedOccurrences,
    scheduledOccurrences,
    completionRate,
    bestCurrentStreak: Math.max(0, ...currentStreaks.map((streak) => streak.current)),
    longestStreak: Math.max(0, ...currentStreaks.map((streak) => streak.longest)),
    habits,
    mostConsistent: habits.find((habit) => habit.scheduled > 0) ?? null,
    leastConsistent: comparableHabits.length >= 2 ? comparableHabits.at(-1) ?? null : null,
  }
}

function getRangeStart(range: InsightRange, habits: Habit[], endDate: string): string | null {
  if (range === 'all') {
    const availableStarts = habits
      .filter((habit) => !habit.archived || Boolean(habit.archivedAt))
      .map(getHabitStartDateKey)
      .filter((date): date is string => date !== null && date <= endDate)
    return availableStarts.length ? availableStarts.sort()[0] : null
  }

  const days = Number.parseInt(range, 10)
  return addDaysToKey(endDate, -(days - 1))
}

function buildDailyInsights(
  habits: Habit[],
  completions: HabitData['completions'],
  startDate: string,
  endDate: string,
): DailyInsight[] {
  const days: DailyInsight[] = []
  for (let date = startDate; date <= endDate; date = addDaysToKey(date, 1)) {
    const scheduledHabits = habits.filter((habit) => isScheduledOnDate(habit, date))
    const completedIds = new Set(completions[date] ?? [])
    const completed = scheduledHabits.filter((habit) => completedIds.has(habit.id)).length
    days.push({
      date,
      completed,
      scheduled: scheduledHabits.length,
      rate: scheduledHabits.length ? completed / scheduledHabits.length : null,
    })
  }
  return days
}

function countHabitOccurrences(
  habit: Habit,
  completions: HabitData['completions'],
  days: DailyInsight[],
): Pick<HabitConsistency, 'completed' | 'scheduled'> {
  let scheduled = 0
  let completed = 0
  for (const day of days) {
    if (!isScheduledForHabit(habit, day.date)) continue
    scheduled += 1
    if (completions[day.date]?.includes(habit.id)) completed += 1
  }
  return { completed, scheduled }
}

function isScheduledOnDate(habit: Habit, date: string): boolean {
  if (!isHabitActiveOnDate(habit, date)) return false
  return isScheduledForHabit(habit, date)
}

function isScheduledForHabit(habit: Habit, date: string): boolean {
  const schedule = getScheduleOnDate(habit, date)
  if (!schedule) return false
  if (schedule.frequency === 'daily') return true
  return schedule.weekdays.includes(dateFromKey(date).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6)
}

function compareConsistency(a: HabitConsistency, b: HabitConsistency): number {
  if (a.rate === null && b.rate !== null) return 1
  if (a.rate !== null && b.rate === null) return -1
  return (b.rate ?? 0) - (a.rate ?? 0) || a.habit.name.localeCompare(b.habit.name)
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
