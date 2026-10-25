import { sanitizeHabitData, type HabitData } from '../domain/habits'
import { HABIT_STORAGE_KEY, saveHabitData } from './habitStorage'
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  type UserPreferences,
} from './preferences'

export const BACKUP_SCHEMA_VERSION = 1

// Version 1 shape: { schemaVersion, exportedAt, data: { habits, completions }, preferences: { theme, weekStartsOn } }.
export interface StillBackup {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION
  exportedAt: string
  data: HabitData
  preferences: UserPreferences
}

export interface BackupSummary {
  backup: StillBackup
  habitCount: number
  completionRecordCount: number
}

export function createBackup(data: HabitData, preferences: UserPreferences, exportedAt = new Date()): StillBackup {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    data: structuredClone(data),
    preferences: { ...preferences },
  }
}

export function validateBackup(input: unknown): BackupSummary {
  if (!isRecord(input)) throw new Error('The file is not a Still backup object.')
  if (input.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error('This backup version is not supported.')
  if (typeof input.exportedAt !== 'string' || Number.isNaN(Date.parse(input.exportedAt))) {
    throw new Error('The backup export timestamp is missing or invalid.')
  }
  if (!isRecord(input.preferences)) throw new Error('Backup preferences are missing or invalid.')
  const theme = input.preferences.theme
  const weekStartsOn = input.preferences.weekStartsOn
  if (!['dark', 'light', 'system'].includes(String(theme)) || !isWeekday(weekStartsOn)) {
    throw new Error('Backup preferences contain an unsupported value.')
  }
  if (!isRecord(input.data) || !Array.isArray(input.data.habits) || !isRecord(input.data.completions)) {
    throw new Error('The backup is missing its habits or completion history.')
  }

  const rawData = input.data as Record<string, unknown>
  const rawHabits = rawData.habits as unknown[]
  const rawCompletions = rawData.completions as Record<string, unknown>
  const ids = new Set<string>()
  for (const value of rawHabits) {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) throw new Error('A habit record is invalid.')
    if (typeof value.name !== 'string' || !value.name.trim() || typeof value.description !== 'string' ||
        typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt)) || typeof value.archived !== 'boolean' ||
        !isValidSchedule(value.schedule)) throw new Error('A habit record contains invalid details.')
    if (value.archivedAt !== undefined && (typeof value.archivedAt !== 'string' || !isValidDateKey(value.archivedAt))) {
      throw new Error(`The archive date for ${value.name} is invalid.`)
    }
    if (value.scheduleHistory !== undefined && (!Array.isArray(value.scheduleHistory) || value.scheduleHistory.some((entry) =>
      !isRecord(entry) || typeof entry.effectiveFrom !== 'string' || !isValidDateKey(entry.effectiveFrom) || !isValidSchedule(entry.schedule)))) {
      throw new Error(`The schedule history for ${value.name} is invalid.`)
    }
    if (ids.has(value.id)) throw new Error(`Duplicate habit ID found: ${value.id}`)
    ids.add(value.id)
  }

  let completionRecordCount = 0
  for (const [date, value] of Object.entries(rawCompletions)) {
    if (!isValidDateKey(date) || !Array.isArray(value)) throw new Error('A completion date or record list is invalid.')
    const dayIds = new Set<string>()
    for (const id of value) {
      if (typeof id !== 'string' || !ids.has(id)) throw new Error(`A completion on ${date} refers to an unknown habit.`)
      if (dayIds.has(id)) throw new Error(`Duplicate completion record found for ${date}.`)
      dayIds.add(id)
      completionRecordCount += 1
    }
  }

  const data = sanitizeHabitData(rawData)
  if (data.habits.length !== rawHabits.length || Object.keys(data.completions).length !== Object.keys(rawCompletions).filter((key) => Array.isArray(rawCompletions[key]) && (rawCompletions[key] as unknown[]).length > 0).length) {
    throw new Error('The backup contains one or more invalid habit or completion records.')
  }
  const validatedBackup: StillBackup = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    data,
    preferences: { theme: theme as UserPreferences['theme'], weekStartsOn },
  }
  return { backup: validatedBackup, habitCount: data.habits.length, completionRecordCount }
}

export function downloadBackup(data: HabitData, preferences: UserPreferences): void {
  const backup = createBackup(data, preferences)
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `still-backup-${backup.exportedAt.slice(0, 10)}.json`
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function restoreBackup(backup: StillBackup): void {
  const previousData = window.localStorage.getItem(HABIT_STORAGE_KEY)
  const previousPreferences = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
  try {
    saveHabitData(backup.data)
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(backup.preferences))
  } catch (error) {
    restoreValue(HABIT_STORAGE_KEY, previousData)
    restoreValue(PREFERENCES_STORAGE_KEY, previousPreferences)
    throw error
  }
}

export function clearStoredApplicationData(): void {
  const previousData = window.localStorage.getItem(HABIT_STORAGE_KEY)
  const previousPreferences = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
  try {
    window.localStorage.removeItem(HABIT_STORAGE_KEY)
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY)
  } catch (error) {
    restoreValue(HABIT_STORAGE_KEY, previousData)
    restoreValue(PREFERENCES_STORAGE_KEY, previousPreferences)
    throw error
  }
}

export function defaultPreferences(): UserPreferences {
  return { ...DEFAULT_PREFERENCES }
}

function restoreValue(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Best-effort rollback if the browser storage implementation fails mid-transaction.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isWeekday(value: unknown): value is UserPreferences['weekStartsOn'] {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function isValidSchedule(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.frequency === 'daily') return true
  return value.frequency === 'weekly' && Array.isArray(value.weekdays) && value.weekdays.length > 0 &&
    value.weekdays.every((day) => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6) &&
    new Set(value.weekdays).size === value.weekdays.length
}
