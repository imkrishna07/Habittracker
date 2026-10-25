import {
  getHabitStartDateKey,
  getScheduleOnDate,
  isHabitActiveOnDate,
  localDateKey,
  type Habit,
  type HabitData,
} from './habits'

export interface HabitStreaks {
  current: number
  longest: number
}

export function calculateHabitStreaks(
  habit: Habit,
  completions: HabitData['completions'],
  asOf = new Date(),
): HabitStreaks {
  const startDate = getHabitStartDateKey(habit)
  if (!startDate) return { current: 0, longest: 0 }

  const asOfKey = localDateKey(asOf)
  const archiveEnd = habit.archived && habit.archivedAt
    ? addDaysToKey(habit.archivedAt, -1)
    : asOfKey
  const longestEnd = archiveEnd < asOfKey ? archiveEnd : asOfKey
  const longest = longestEnd < startDate
    ? 0
    : measureLongest(habit, completions, startDate, longestEnd)

  if (habit.archived || startDate > asOfKey) return { current: 0, longest }

  const todaySchedule = getScheduleOnDate(habit, asOfKey)
  const todayComplete = completions[asOfKey]?.includes(habit.id) ?? false
  const currentEnd = todaySchedule && !todayComplete ? addDaysToKey(asOfKey, -1) : asOfKey
  const current = countCurrentBackwards(habit, completions, startDate, currentEnd)

  return { current, longest }
}

function countCurrentBackwards(
  habit: Habit,
  completions: HabitData['completions'],
  startDate: string,
  endDate: string,
): number {
  let streak = 0
  let day = endDate
  while (day >= startDate) {
    if (!isHabitActiveOnDate(habit, day)) break
    const schedule = getScheduleOnDate(habit, day)
    if (schedule && isScheduledWeekday(schedule, day)) {
      if (completions[day]?.includes(habit.id)) streak += 1
      else break
    }
    day = addDaysToKey(day, -1)
  }
  return streak
}

function measureLongest(
  habit: Habit,
  completions: HabitData['completions'],
  startDate: string,
  endDate: string,
): number {
  let running = 0
  let longest = 0
  for (let day = startDate; day <= endDate; day = addDaysToKey(day, 1)) {
    if (!isHabitActiveOnDate(habit, day)) {
      running = 0
      continue
    }
    const schedule = getScheduleOnDate(habit, day)
    if (!schedule || !isScheduledWeekday(schedule, day)) continue
    if (completions[day]?.includes(habit.id)) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
  }
  return longest
}

function isScheduledWeekday(schedule: NonNullable<ReturnType<typeof getScheduleOnDate>>, dateKey: string): boolean {
  if (schedule.frequency === 'daily') return true
  return schedule.weekdays.includes(localDateFromKey(dateKey).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6)
}

function localDateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function addDaysToKey(key: string, amount: number): string {
  const date = localDateFromKey(key)
  date.setDate(date.getDate() + amount)
  return localDateKey(date)
}
