export type ThemePreference = 'dark' | 'light' | 'system'
export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface UserPreferences {
  theme: ThemePreference
  weekStartsOn: WeekStartsOn
}

export const PREFERENCES_STORAGE_KEY = 'still.preferences.v1'
export const DEFAULT_PREFERENCES: UserPreferences = { theme: 'dark', weekStartsOn: 0 }

export function loadPreferences(): UserPreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return DEFAULT_PREFERENCES
    const candidate = value as Partial<UserPreferences>
    return {
      theme: candidate.theme === 'light' || candidate.theme === 'system' ? candidate.theme : 'dark',
      weekStartsOn: isWeekday(candidate.weekStartsOn) ? candidate.weekStartsOn : 0,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(preferences: UserPreferences): void {
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}

function isWeekday(value: unknown): value is WeekStartsOn {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6
}
