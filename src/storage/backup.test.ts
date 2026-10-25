import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HabitData } from '../domain/habits'
import { HABIT_STORAGE_KEY, loadHabitData } from './habitStorage'
import { createBackup, downloadBackup, restoreBackup, validateBackup } from './backup'
import { DEFAULT_PREFERENCES, PREFERENCES_STORAGE_KEY, loadPreferences } from './preferences'

const data: HabitData = {
  habits: [{
    id: 'read', name: 'Read', description: '', schedule: { frequency: 'weekly', weekdays: [1, 3] },
    createdAt: '2025-12-01T10:00:00.000Z', archived: false,
    scheduleHistory: [{ effectiveFrom: '2025-12-01', schedule: { frequency: 'daily' } }],
  }],
  completions: { '2026-01-05': ['read'] },
}

beforeEach(() => window.localStorage.clear())

describe('versioned Still backups', () => {
  it('creates a documented backup and validates its counts', () => {
    const backup = createBackup(data, { theme: 'light', weekStartsOn: 1 }, new Date('2026-10-25T12:00:00.000Z'))
    expect(backup.schemaVersion).toBe(1)
    expect(backup.exportedAt).toBe('2026-10-25T12:00:00.000Z')
    expect(validateBackup(backup)).toMatchObject({ habitCount: 1, completionRecordCount: 1 })
  })

  it('downloads a valid JSON blob with a backup filename', async () => {
    let downloadedBlob: Blob | undefined
    let downloadName = ''
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloadName = this.download })
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: (blob: Blob) => { downloadedBlob = blob; return 'blob:still-backup' } })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    downloadBackup(data, DEFAULT_PREFERENCES)
    expect(downloadedBlob?.type).toBe('application/json')
    expect(downloadedBlob?.size).toBeGreaterThan(0)
    expect(downloadName).toMatch(/^still-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect(anchorClick).toHaveBeenCalledOnce()
    const serialized = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No blob text'))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(downloadedBlob!)
    })
    expect(validateBackup(JSON.parse(serialized)).habitCount).toBe(1)
    anchorClick.mockRestore()
  })

  it('rejects malformed versions, invalid habits, unknown completion IDs, and duplicate records', () => {
    const valid = createBackup(data, DEFAULT_PREFERENCES)
    expect(() => validateBackup({ ...valid, schemaVersion: 2 })).toThrow(/not supported/i)
    expect(() => validateBackup({ ...valid, data: { ...data, habits: [{ ...data.habits[0], name: ' ' }] } })).toThrow(/invalid details/i)
    expect(() => validateBackup({ ...valid, data: { ...data, completions: { '2026-01-05': ['missing'] } } })).toThrow(/unknown habit/i)
    expect(() => validateBackup({ ...valid, data: { ...data, completions: { '2026-01-05': ['read', 'read'] } } })).toThrow(/duplicate completion/i)
    expect(() => validateBackup({ ...valid, data: { ...data, habits: [data.habits[0], data.habits[0]] } })).toThrow(/duplicate habit/i)
  })

  it('restores habits, completion history, and preferences together', () => {
    window.localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify({ habits: [], completions: {} }))
    const backup = validateBackup(createBackup(data, { theme: 'system', weekStartsOn: 1 })).backup
    restoreBackup(backup)
    expect(loadHabitData().data).toEqual(data)
    expect(loadPreferences()).toEqual({ theme: 'system', weekStartsOn: 1 })
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).not.toBeNull()
  })

  it('does not alter existing storage when validation fails before restore', () => {
    const existing = { habits: [], completions: {} }
    window.localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(existing))
    const malformed = { ...createBackup(data, DEFAULT_PREFERENCES), schemaVersion: 9 }
    expect(() => validateBackup(malformed)).toThrow()
    expect(window.localStorage.getItem(HABIT_STORAGE_KEY)).toBe(JSON.stringify(existing))
  })
})
