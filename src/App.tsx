import { useEffect, useMemo, useState } from 'react'
import { Activity, Archive, ArchiveRestore, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Flame, Pencil, Plus, Settings as SettingsIcon, Trash2 } from 'lucide-react'
import { ActivityHeatmap } from './components/ActivityHeatmap'
import { ConfirmDialog } from './components/ConfirmDialog'
import { HabitForm, type HabitDraft } from './components/HabitForm'
import { InsightsPage } from './components/InsightsPage'
import { HabitDetailPage } from './components/HabitDetailPage'
import { SettingsPage } from './components/SettingsPage'
import {
  createHabitId,
  changeHabitSchedule,
  getScheduleOnDate,
  isHabitActiveOnDate,
  isScheduledOn,
  localDateKey,
  scheduleLabel,
  toggleCompletion,
  type Habit,
  type HabitData,
} from './domain/habits'
import { calculateHabitStreaks } from './domain/streaks'
import { loadHabitData, saveHabitData } from './storage/habitStorage'
import { clearStoredApplicationData, restoreBackup, type StillBackup } from './storage/backup'
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type UserPreferences } from './storage/preferences'

type Page = 'today' | 'habits' | 'insights' | 'settings' | 'habit-detail'
type ModalState = { type: 'create' } | { type: 'edit'; habit: Habit } | { type: 'delete'; habit: Habit } | null

const todayLabel = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date()).toUpperCase()
const selectedDateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

function addDaysToKey(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  date.setDate(date.getDate() + amount)
  return localDateKey(date)
}

function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function getHabitIdFromHash(): string | null {
  if (typeof window === 'undefined' || !window.location.hash.startsWith('#habit/')) return null
  try { return decodeURIComponent(window.location.hash.slice('#habit/'.length)) } catch { return null }
}

function App() {
  const [initialData] = useState(loadHabitData)
  const [data, setData] = useState<HabitData>(initialData.data)
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences)
  const [selectedDateKey, setSelectedDateKey] = useState(() => localDateKey())
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(getHabitIdFromHash)
  const [detailReturnPage, setDetailReturnPage] = useState<'today' | 'habits'>('habits')
  const [page, setPage] = useState<Page>(() => getHabitIdFromHash() ? 'habit-detail' : 'today')
  const [modal, setModal] = useState<ModalState>(null)
  const [storageError, setStorageError] = useState(
    initialData.recovered ? 'Some saved data could not be read. Your habits are safe to edit and save again.' : '',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme
  }, [preferences.theme])

  useEffect(() => {
    function syncRoute() {
      const habitId = getHabitIdFromHash()
      setSelectedHabitId(habitId)
      setPage(habitId ? 'habit-detail' : detailReturnPage)
    }
    window.addEventListener('popstate', syncRoute)
    window.addEventListener('hashchange', syncRoute)
    return () => {
      window.removeEventListener('popstate', syncRoute)
      window.removeEventListener('hashchange', syncRoute)
    }
  }, [detailReturnPage])

  const activeHabits = useMemo(() => data.habits.filter((habit) => !habit.archived), [data.habits])
  const archivedHabits = useMemo(() => data.habits.filter((habit) => habit.archived), [data.habits])
  const selectedHabit = data.habits.find((habit) => habit.id === selectedHabitId) ?? null
  const today = new Date()
  const todayKey = localDateKey(today)
  const selectedDate = dateFromKey(selectedDateKey)
  const viewingToday = selectedDateKey === todayKey
  const scheduledForSelectedDate = data.habits.filter((habit) =>
    isHabitActiveOnDate(habit, selectedDateKey) && isScheduledOn(habit, selectedDate),
  )
  const completedForSelectedDate = new Set(data.completions[selectedDateKey] ?? [])
  const completedCount = scheduledForSelectedDate.filter((habit) => completedForSelectedDate.has(habit.id)).length
  const completionPercent = scheduledForSelectedDate.length ? Math.round((completedCount / scheduledForSelectedDate.length) * 100) : 0
  const streaksById = useMemo(() => new Map(
    data.habits.map((habit) => [habit.id, calculateHabitStreaks(habit, data.completions, today)]),
  ), [data.habits, data.completions, todayKey])

  function commit(next: HabitData) {
    setData(next)
    try {
      saveHabitData(next)
      setStorageError('')
    } catch {
      setStorageError('Your changes are visible, but this browser could not save them.')
    }
  }

  function saveHabit(draft: HabitDraft) {
    if (modal?.type === 'edit') {
      commit({
        ...data,
        habits: data.habits.map((habit) => {
          if (habit.id !== modal.habit.id) return habit
          const scheduleChanged = JSON.stringify(habit.schedule) !== JSON.stringify(draft.schedule)
          const withScheduleHistory = scheduleChanged
            ? changeHabitSchedule(habit, draft.schedule, todayKey)
            : habit
          return { ...withScheduleHistory, ...draft }
        }),
      })
    } else {
      const habit: Habit = {
        id: createHabitId(),
        ...draft,
        createdAt: new Date().toISOString(),
        archived: false,
      }
      commit({ ...data, habits: [...data.habits, habit] })
    }
    setModal(null)
  }

  function removeHabit(habitId: string) {
    const habits = data.habits.filter((habit) => habit.id !== habitId)
    const completions = Object.fromEntries(
      Object.entries(data.completions)
        .map(([date, ids]) => [date, ids.filter((id) => id !== habitId)])
        .filter(([, ids]) => (ids as string[]).length > 0),
    )
    commit({ habits, completions })
    setModal(null)
  }

  function setHabitArchived(habitId: string, archived: boolean) {
    const archiveDate = new Date()
    archiveDate.setDate(archiveDate.getDate() + 1)
    commit({
      ...data,
      habits: data.habits.map((habit) => habit.id === habitId
        ? { ...habit, archived, archivedAt: archived ? localDateKey(archiveDate) : undefined }
        : habit),
    })
  }

  function toggleHabit(habitId: string) {
    commit(toggleCompletion(data, habitId, selectedDateKey))
  }

  function openHabitDetail(habitId: string) {
    if (page !== 'habit-detail') setDetailReturnPage(page === 'today' ? 'today' : 'habits')
    window.history.pushState({}, '', `#habit/${encodeURIComponent(habitId)}`)
    setSelectedHabitId(habitId)
    setPage('habit-detail')
  }

  function closeHabitDetail() {
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
    setSelectedHabitId(null)
    setPage(detailReturnPage)
  }

  function navigateTo(nextPage: Exclude<Page, 'habit-detail'>) {
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
    setSelectedHabitId(null)
    setPage(nextPage)
    if (nextPage === 'today') setSelectedDateKey(todayKey)
  }

  function selectDate(dateKey: string) {
    if (dateKey <= todayKey && localDateKey(dateFromKey(dateKey)) === dateKey) setSelectedDateKey(dateKey)
  }

  function updatePreferences(next: UserPreferences) {
    savePreferences(next)
    setPreferences(next)
  }

  function applyRestore(backup: StillBackup) {
    restoreBackup(backup)
    setData(backup.data)
    setPreferences(backup.preferences)
    setStorageError('')
  }

  function clearLocalData() {
    clearStoredApplicationData()
    setData({ habits: [], completions: {} })
    setPreferences({ ...DEFAULT_PREFERENCES })
    setStorageError('')
  }

  const currentTitle = page === 'today' ? 'Today' : page === 'habits' ? 'Habits' : page === 'insights' ? 'Insights' : page === 'settings' ? 'Settings' : selectedHabit?.name ?? 'Habit'

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#today" aria-label="Still home" onClick={(event) => { event.preventDefault(); navigateTo('today') }}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>still</span>
        </a>

        <div className="workspace-label">PERSONAL SPACE</div>
        <nav className="nav-list" aria-label="Pages">
          <button className={`nav-item${page === 'today' || (page === 'habit-detail' && detailReturnPage === 'today') ? ' is-active' : ''}`} type="button" aria-label="Today" onClick={() => navigateTo('today')} aria-current={page === 'today' || (page === 'habit-detail' && detailReturnPage === 'today') ? 'page' : undefined}>
            <Circle size={16} strokeWidth={1.7} aria-hidden="true" />
            <span>Today</span>
          </button>
          <button className={`nav-item${page === 'habits' || (page === 'habit-detail' && detailReturnPage === 'habits') ? ' is-active' : ''}`} type="button" aria-label={`Habits, ${activeHabits.length} active`} onClick={() => navigateTo('habits')} aria-current={page === 'habits' || (page === 'habit-detail' && detailReturnPage === 'habits') ? 'page' : undefined}>
            <Check size={16} strokeWidth={1.7} aria-hidden="true" />
            <span>Habits</span>
            <span className="nav-count" aria-label={`${activeHabits.length} active habits`}>{activeHabits.length}</span>
          </button>
          <button className={`nav-item${page === 'insights' ? ' is-active' : ''}`} type="button" aria-label="Insights" onClick={() => navigateTo('insights')} aria-current={page === 'insights' ? 'page' : undefined}>
            <Activity size={16} strokeWidth={1.7} aria-hidden="true" />
            <span>Insights</span>
          </button>
          <button className={`nav-item${page === 'settings' ? ' is-active' : ''}`} type="button" aria-label="Settings" onClick={() => navigateTo('settings')} aria-current={page === 'settings' ? 'page' : undefined}>
            <SettingsIcon size={16} strokeWidth={1.7} aria-hidden="true" />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <span className="avatar" aria-hidden="true">Y</span>
          <span className="profile-name">Your space</span>
        </div>
      </aside>

      <main className="main-panel" id={page}>
        <header className="topbar">
          <div className="breadcrumb"><span>Personal space</span><span className="breadcrumb-divider">/</span><strong>{currentTitle}</strong></div>
          <button className="button button-primary button-small" type="button" onClick={() => setModal({ type: 'create' })}>
            <Plus size={15} strokeWidth={1.8} /><span>New habit</span>
          </button>
        </header>

        {page === 'today' ? (
          <>
            <section className="welcome-section" aria-labelledby="page-title">
              <p className="eyebrow">{viewingToday ? todayLabel : 'HISTORICAL ACTIVITY'}</p>
              <h1 id="page-title">A little, every day.</h1>
              <p className="welcome-copy">Make room for the things you want to become.</p>
            </section>
            <section className="today-date-navigation" aria-label="Choose activity date">
              <button className="date-step-button" type="button" aria-label="Previous day" title="Previous day"
                onClick={() => selectDate(addDaysToKey(selectedDateKey, -1))}>
                <ChevronLeft size={16} strokeWidth={1.8} />
              </button>
              <label className="date-picker-control">
                <CalendarDays size={15} strokeWidth={1.7} aria-hidden="true" />
                <span className="visually-hidden">Select activity date</span>
                <input aria-label="Select activity date" type="date" value={selectedDateKey} max={todayKey}
                  onChange={(event) => selectDate(event.currentTarget.value)} />
              </label>
              <button className="date-step-button" type="button" aria-label="Next day" title="Next day"
                disabled={viewingToday} onClick={() => selectDate(addDaysToKey(selectedDateKey, 1))}>
                <ChevronRight size={16} strokeWidth={1.8} />
              </button>
              {!viewingToday && <button className="button button-quiet date-today-button" type="button" aria-label="Return to today" onClick={() => selectDate(todayKey)}>Today</button>}
              {!viewingToday && <span className="date-history-label">Historical activity · {selectedDateLabel.format(selectedDate)}</span>}
            </section>
            {data.habits.length === 0 ? (
              <section className="empty-state" aria-label="Getting started">
                <div className="empty-mark" aria-hidden="true"><span className="empty-mark-ring" /><span className="empty-mark-dot" /></div>
                <h2>Your day starts here</h2>
                <p>Add a habit to make it part of your day.<br className="desktop-break" /> Small steps have a way of adding up.</p>
                <button className="button button-secondary" type="button" onClick={() => setModal({ type: 'create' })}>
                  <Plus size={15} strokeWidth={1.8} /><span>Create your first habit</span>
                  <ArrowUpRight className="button-trailing-icon" size={14} strokeWidth={1.8} />
                </button>
              </section>
            ) : scheduledForSelectedDate.length === 0 ? (
              <section className="rest-state" aria-label="No habits scheduled for this date">
                <div className="rest-mark" aria-hidden="true"><Circle size={20} strokeWidth={1.2} /></div>
                <h2>A day to breathe.</h2>
                <p>{viewingToday ? 'Nothing is scheduled for today. Your habits are right where you left them.' : 'Nothing is scheduled for this date. Your habits are right where you left them.'}</p>
                <button className="button button-quiet" type="button" onClick={() => navigateTo('habits')}>View habits <ArrowUpRight size={14} /></button>
              </section>
            ) : (
              <section className="today-content" aria-labelledby="daily-list-title">
                <div className="daily-summary">
                  <div><h2 id="daily-list-title">{viewingToday ? 'Today’s practice' : 'Past practice'}</h2><p>{completedCount} of {scheduledForSelectedDate.length} complete</p></div>
                  <div className="daily-percent" aria-label={`${completionPercent}% complete`}>{completionPercent}<span>%</span></div>
                </div>
                <div className="progress-track" role="progressbar" aria-label={viewingToday ? 'Daily progress' : 'Historical daily progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}>
                  <span style={{ width: `${completionPercent}%` }} />
                </div>
                <ul className="daily-list">
                  {scheduledForSelectedDate.map((habit) => {
                    const complete = completedForSelectedDate.has(habit.id)
                    const selectedSchedule = getScheduleOnDate(habit, selectedDateKey) ?? habit.schedule
                    return (
                      <li className={`daily-row${complete ? ' is-complete' : ''}`} key={habit.id}>
                        <button className="completion-toggle" type="button" role="checkbox" aria-checked={complete}
                          aria-label={`${complete ? 'Mark incomplete' : 'Mark complete'}: ${habit.name}`} onClick={() => toggleHabit(habit.id)}>
                          {complete && <Check size={13} strokeWidth={2} />}
                        </button>
                        <span className="daily-habit-copy">
                          <button className="daily-habit-name habit-detail-link" type="button" aria-label={`View details for ${habit.name}`} onClick={() => openHabitDetail(habit.id)}>{habit.name}</button>
                          {habit.description && <span className="daily-habit-description">{habit.description}</span>}
                        </span>
                        <StreakIndicator habit={habit} current={streaksById.get(habit.id)?.current ?? 0} longest={streaksById.get(habit.id)?.longest ?? 0} />
                        <span className="daily-schedule">{scheduleLabel(selectedSchedule)}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </>
        ) : page === 'habits' ? (
          <>
            <section className="welcome-section habits-heading" aria-labelledby="page-title">
              <p className="eyebrow">YOUR PRACTICE</p><h1 id="page-title">Habits</h1>
              <p className="welcome-copy">A few steady things, made your own.</p>
            </section>
            {activeHabits.length === 0 ? (
              <section className="habits-empty">
                <p>No habits yet. Start with one small thing you’d like to do regularly.</p>
                <button className="button button-secondary" type="button" onClick={() => setModal({ type: 'create' })}><Plus size={15} /><span>Create your first habit</span></button>
              </section>
            ) : (
              <section className="habits-content" aria-label="Active habits">
                <div className="list-heading"><span>ACTIVE</span><span>{activeHabits.length} {activeHabits.length === 1 ? 'HABIT' : 'HABITS'}</span></div>
                <ul className="manage-list">
                  {activeHabits.map((habit) => (
                    <li className="manage-row" key={habit.id}>
                      <div className="manage-habit-copy">
                        <button className="daily-habit-name habit-detail-link" type="button" aria-label={`View details for ${habit.name}`} onClick={() => openHabitDetail(habit.id)}>{habit.name}</button>
                        <span className="manage-meta">{scheduleLabel(habit.schedule)}{habit.description ? ` · ${habit.description}` : ''}</span>
                        <StreakIndicator habit={habit} current={streaksById.get(habit.id)?.current ?? 0} longest={streaksById.get(habit.id)?.longest ?? 0} />
                      </div>
                      <div className="manage-actions">
                        <button className="icon-button" type="button" aria-label={`Archive ${habit.name}`} onClick={() => setHabitArchived(habit.id, true)}><Archive size={15} strokeWidth={1.7} /></button>
                        <button className="icon-button" type="button" aria-label={`Edit ${habit.name}`} onClick={() => setModal({ type: 'edit', habit })}><Pencil size={15} strokeWidth={1.7} /></button>
                        <button className="icon-button delete-icon" type="button" aria-label={`Delete ${habit.name}`} onClick={() => setModal({ type: 'delete', habit })}><Trash2 size={15} strokeWidth={1.7} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {archivedHabits.length > 0 && <section className="habits-content archived-content" aria-label="Archived habits">
              <div className="list-heading"><span>ARCHIVED</span><span>{archivedHabits.length} {archivedHabits.length === 1 ? 'HABIT' : 'HABITS'}</span></div>
              <ul className="manage-list">
                {archivedHabits.map((habit) => <li className="manage-row archived-row" key={habit.id}>
                  <div className="manage-habit-copy"><button className="daily-habit-name habit-detail-link" type="button" aria-label={`View details for ${habit.name}`} onClick={() => openHabitDetail(habit.id)}>{habit.name}</button><span className="manage-meta">{scheduleLabel(habit.schedule)}{habit.description ? ` · ${habit.description}` : ''}</span></div>
                  <div className="manage-actions">
                    <button className="icon-button" type="button" aria-label={`Restore ${habit.name}`} onClick={() => setHabitArchived(habit.id, false)}><ArchiveRestore size={15} strokeWidth={1.7} /></button>
                    <button className="icon-button delete-icon" type="button" aria-label={`Delete ${habit.name}`} onClick={() => setModal({ type: 'delete', habit })}><Trash2 size={15} strokeWidth={1.7} /></button>
                  </div>
                </li>)}
              </ul>
            </section>}
          </>
        ) : page === 'insights' ? <InsightsPage data={data} today={today} onCreateHabit={() => setModal({ type: 'create' })} />
          : page === 'settings' ? <SettingsPage data={data} preferences={preferences} onPreferencesChange={updatePreferences} onRestore={applyRestore} onClear={clearLocalData} />
            : <HabitDetailPage habit={selectedHabit} data={data} today={today} weekStartsOn={preferences.weekStartsOn} onBack={closeHabitDetail} />}

        {page === 'today' && data.habits.length > 0 && <ActivityHeatmap habits={data.habits} completions={data.completions} endDate={today} weekStartsOn={preferences.weekStartsOn} />}

        {storageError && <p className="storage-message" role="status">{storageError}</p>}
        <footer className="page-footer"><span>Consistency, at your own pace.</span><span className="footer-indicator"><span /> READY WHEN YOU ARE</span></footer>
      </main>

      {modal?.type === 'create' && <HabitForm onCancel={() => setModal(null)} onSave={saveHabit} />}
      {modal?.type === 'edit' && <HabitForm key={modal.habit.id} initialHabit={modal.habit} onCancel={() => setModal(null)} onSave={saveHabit} />}
      {modal?.type === 'delete' && <ConfirmDialog habitName={modal.habit.name} onCancel={() => setModal(null)} onConfirm={() => removeHabit(modal.habit.id)} />}
    </div>
  )
}

function StreakIndicator({ habit, current, longest }: { habit: Habit; current: number; longest: number }) {
  const plural = (value: number) => `${value} ${value === 1 ? 'day' : 'days'}`
  return (
    <span className="streak-indicator" aria-label={`${habit.name}: current streak ${plural(current)}, longest streak ${plural(longest)}`} title={`Current ${plural(current)} · Longest ${plural(longest)}`}>
      <Flame size={13} strokeWidth={1.7} aria-hidden="true" />
      <span>{current}</span>
      <span className="streak-best">best {longest}</span>
    </span>
  )
}

export default App
