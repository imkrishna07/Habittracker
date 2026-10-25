export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type HabitSchedule =
  | { frequency: 'daily' }
  | { frequency: 'weekly'; weekdays: Weekday[] }

export interface ScheduleHistoryEntry {
  effectiveFrom: string
  schedule: HabitSchedule
}

export interface Habit {
  id: string
  name: string
  description: string
  schedule: HabitSchedule
  scheduleHistory?: ScheduleHistoryEntry[]
  createdAt: string
  archived: boolean
  archivedAt?: string
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
  const schedule = getScheduleOnDate(habit, localDateKey(date))
  if (!schedule) return false
  if (schedule.frequency === 'daily') return true
  return schedule.weekdays.includes(date.getDay() as Weekday)
}

export function getHabitStartDateKey(habit: Habit): string | null {
  const createdAt = new Date(habit.createdAt)
  return Number.isNaN(createdAt.getTime()) ? null : localDateKey(createdAt)
}

export function isHabitActiveOnDate(habit: Habit, dateKey: string): boolean {
  const startDate = getHabitStartDateKey(habit)
  if (!startDate || dateKey < startDate) return false
  if (!habit.archived) return true
  return Boolean(habit.archivedAt && isDateKey(habit.archivedAt) && dateKey < habit.archivedAt)
}

export function getScheduleOnDate(habit: Habit, dateKey: string): HabitSchedule | null {
  if (!isHabitActiveOnDate({ ...habit, archived: false }, dateKey)) return null
  const history = habit.scheduleHistory?.filter((entry) => isDateKey(entry.effectiveFrom))
  if (!history?.length) return habit.schedule
  const applicable = [...history]
    .filter((entry) => entry.effectiveFrom <= dateKey)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  return applicable.at(-1)?.schedule ?? habit.schedule
}

export function changeHabitSchedule(habit: Habit, schedule: HabitSchedule, effectiveFrom: string): Habit {
  const startDate = getHabitStartDateKey(habit) ?? effectiveFrom
  const previousHistory = habit.scheduleHistory?.length
    ? habit.scheduleHistory
    : [{ effectiveFrom: startDate, schedule: habit.schedule }]
  const history = previousHistory.filter((entry) => entry.effectiveFrom < effectiveFrom)
  if (!history.length && startDate < effectiveFrom) {
    history.push({ effectiveFrom: startDate, schedule: getScheduleOnDate(habit, startDate) ?? habit.schedule })
  }
  history.push({ effectiveFrom, schedule })
  return { ...habit, schedule, scheduleHistory: history }
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

    const schedule = sanitizeSchedule(habit.schedule)
    if (!schedule) continue

    const scheduleHistory = Array.isArray(habit.scheduleHistory)
      ? habit.scheduleHistory.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || !isDateKey(entry.effectiveFrom)) return []
        const historicalSchedule = sanitizeSchedule(entry.schedule)
        return historicalSchedule ? [{ effectiveFrom: entry.effectiveFrom, schedule: historicalSchedule }] : []
      }).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
      : undefined
    const archivedAt = typeof habit.archivedAt === 'string' && isDateKey(habit.archivedAt) ? habit.archivedAt : undefined

    seenIds.add(habit.id)
    habits.push({ ...habit, name: habit.name.trim(), schedule, scheduleHistory, archivedAt } as Habit)
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

function sanitizeSchedule(value: unknown): HabitSchedule | null {
  if (!value || typeof value !== 'object') return null
  const schedule = value as Partial<HabitSchedule>
  if (schedule.frequency === 'daily') return { frequency: 'daily' }
  if (schedule.frequency !== 'weekly' || !Array.isArray(schedule.weekdays)) return null
  const weekdays = [...new Set(schedule.weekdays.filter(isWeekday))]
  return weekdays.length ? { frequency: 'weekly', weekdays } : null
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  return localDateKey(new Date(year, month - 1, day, 12)) === value
}
