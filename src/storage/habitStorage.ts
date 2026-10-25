import { EMPTY_HABIT_DATA, sanitizeHabitData, type HabitData } from '../domain/habits'

export const HABIT_STORAGE_KEY = 'still.habit-data.v1'

export interface LoadedHabitData {
  data: HabitData
  recovered: boolean
}

export function loadHabitData(): LoadedHabitData {
  try {
    const serialized = window.localStorage.getItem(HABIT_STORAGE_KEY)
    if (!serialized) return { data: EMPTY_HABIT_DATA, recovered: false }
    const parsed: unknown = JSON.parse(serialized)
    const data = sanitizeHabitData(parsed)
    const recovered = !parsed || typeof parsed !== 'object' ||
      !Array.isArray((parsed as { habits?: unknown }).habits) ||
      !(parsed as { completions?: unknown }).completions || typeof (parsed as { completions?: unknown }).completions !== 'object'
    return { data, recovered }
  } catch {
    return { data: EMPTY_HABIT_DATA, recovered: true }
  }
}

export function saveHabitData(data: HabitData): void {
  window.localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(data))
}
