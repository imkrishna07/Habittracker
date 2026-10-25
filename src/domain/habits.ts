export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type HabitSchedule =
  | { frequency: 'daily' }
  | { frequency: 'weekly'; weekdays: Weekday[] }

export interface Habit {
  id: string
  name: string
  description: string
  schedule: HabitSchedule
  createdAt: string
  archived: boolean
}

export interface HabitData {
  habits: Habit[]
  completions: Record<string, string[]>
}

export const EMPTY_HABIT_DATA: HabitData = { habits: [], completions: {} }

export const WEEKDAYS: { value: Weekday; short: string; label: string }[] = [
  { value: 1, short: 'M', label: 'Monday' },
  { value: 2, short: 'T', label: 'Tuesday' },
  { value: 3, short: 'W', label: 'Wednesday' },
  { value: 4, short: 'T', label: 'Thursday' },
  { value: 5, short: 'F', label: 'Friday' },
  { value: 6, short: 'S', label: 'Saturday' },
  { value: 0, short: 'S', label: 'Sunday' },
]

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isScheduledOn(habit: Habit, date = new Date()): boolean {
  if (habit.schedule.frequency === 'daily') return true
  return habit.schedule.weekdays.includes(date.getDay() as Weekday)
}

export function scheduleLabel(schedule: HabitSchedule): string {
  if (schedule.frequency === 'daily') return 'Every day'
  const selected = WEEKDAYS.filter(({ value }) => schedule.weekdays.includes(value))
  return selected.map(({ short }) => short).join(' · ')
}

export function createHabitId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `habit-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function toggleCompletion(data: HabitData, habitId: string, dateKey: string): HabitData {
  const current = data.completions[dateKey] ?? []
  const next = current.includes(habitId)
    ? current.filter((id) => id !== habitId)
    : [...current, habitId]

  const completions = { ...data.completions }
  if (next.length > 0) completions[dateKey] = [...new Set(next)]
  else delete completions[dateKey]
  return { ...data, completions }
}

export function sanitizeHabitData(value: unknown): HabitData {
  if (!value || typeof value !== 'object') return EMPTY_HABIT_DATA
  const candidate = value as { habits?: unknown; completions?: unknown }
  const rawHabits = Array.isArray(candidate.habits) ? candidate.habits : []
  const habits: Habit[] = []
  const seenIds = new Set<string>()

  for (const raw of rawHabits) {
    if (!raw || typeof raw !== 'object') continue
    const habit = raw as Partial<Habit>
    if (
      typeof habit.id !== 'string' || !habit.id || seenIds.has(habit.id) ||
      typeof habit.name !== 'string' || !habit.name.trim() ||
      typeof habit.description !== 'string' || typeof habit.createdAt !== 'string' ||
      typeof habit.archived !== 'boolean' || !habit.schedule || typeof habit.schedule !== 'object'
    ) continue

    let schedule: HabitSchedule
    if (habit.schedule.frequency === 'daily') {
      schedule = { frequency: 'daily' }
    } else if (
      habit.schedule.frequency === 'weekly' && Array.isArray(habit.schedule.weekdays)
    ) {
      const weekdays = [...new Set(habit.schedule.weekdays.filter(isWeekday))]
      if (weekdays.length === 0) continue
      schedule = { frequency: 'weekly', weekdays }
    } else continue

    seenIds.add(habit.id)
    habits.push({ ...habit, name: habit.name.trim(), schedule } as Habit)
  }

  const completions: Record<string, string[]> = {}
  if (candidate.completions && typeof candidate.completions === 'object') {
    for (const [date, ids] of Object.entries(candidate.completions)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(ids)) continue
      const validIds = [...new Set(ids.filter((id): id is string => typeof id === 'string' && seenIds.has(id)))]
      if (validIds.length) completions[date] = validIds
    }
  }

  return { habits, completions }
}

function isWeekday(value: unknown): value is Weekday {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6
}
