import { useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import { HabitActivityHeatmap } from './HabitActivityHeatmap'
import { calculateHabitInsights } from '../domain/habitInsights'
import type { InsightRange } from '../domain/insights'
import { scheduleLabel, type Habit, type HabitData } from '../domain/habits'
import type { WeekStartsOn } from '../storage/preferences'

const ranges: { id: InsightRange; label: string }[] = [
  { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' }, { id: 'all', label: 'All time' },
]
const weekLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const dayLabel = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

export function HabitDetailPage({
  habit,
  data,
  today,
  weekStartsOn,
  onBack,
}: {
  habit: Habit | null
  data: HabitData
  today: Date
  weekStartsOn: WeekStartsOn
  onBack: () => void
}) {
  const [range, setRange] = useState<InsightRange>('30d')
  const snapshot = useMemo(() => habit ? calculateHabitInsights(habit, data.completions, range, today, weekStartsOn) : null,
    [habit, data.completions, range, today, weekStartsOn])

  if (!habit || !snapshot) {
    return <section className="habit-not-found" aria-labelledby="page-title">
      <p className="eyebrow">YOUR PRACTICE</p><h1 id="page-title">Habit not found</h1>
      <p className="welcome-copy">This habit may have been deleted or the link is no longer valid.</p>
      <button className="button button-secondary" type="button" onClick={onBack}><ArrowLeft size={14} />Back to habits</button>
    </section>
  }

  const recentHistory = snapshot.days.slice(-14).reverse()

  return (
    <>
      <section className="welcome-section habit-detail-heading" aria-labelledby="page-title">
        <button className="button button-quiet habit-back" type="button" onClick={onBack}><ArrowLeft size={14} />Back</button>
        <p className="eyebrow">{habit.archived ? 'ARCHIVED HABIT' : 'YOUR PRACTICE'}</p>
        <h1 id="page-title">{habit.name}</h1>
        <p className="welcome-copy">{habit.description || scheduleLabel(habit.schedule)}</p>
      </section>

      <div className="habit-detail-content">
        <div className="insights-controls" aria-label="Select time range">
          {ranges.map((option) => <button key={option.id} type="button" className={`insight-range-button${range === option.id ? ' is-selected' : ''}`}
            aria-pressed={range === option.id} onClick={() => setRange(option.id)}>{option.label}</button>)}
        </div>

        <section className="habit-detail-metrics" aria-label="Habit statistics">
          <Metric label="COMPLETION RATE" value={formatPercent(snapshot.completionRate)} detail={snapshot.scheduledOccurrences ? `${snapshot.completedOccurrences} of ${snapshot.scheduledOccurrences} scheduled` : 'No scheduled occurrences'} />
          <Metric label="CURRENT STREAK" value={`${snapshot.currentStreak} ${snapshot.currentStreak === 1 ? 'day' : 'days'}`} />
          <Metric label="LONGEST STREAK" value={`${snapshot.longestStreak} ${snapshot.longestStreak === 1 ? 'day' : 'days'}`} />
          <Metric label="COMPLETIONS" value={String(snapshot.completedOccurrences)} />
          <Metric label="SCHEDULED" value={String(snapshot.scheduledOccurrences)} />
          <Metric label="MISSED" value={snapshot.scheduledOccurrences ? String(snapshot.missedOccurrences) : '—'} />
        </section>

        {snapshot.scheduledOccurrences === 0 && <p className="habit-detail-empty" role="status">No scheduled occurrences fall within this period.</p>}

        <section className="habit-detail-section" aria-labelledby="weekly-title">
          <div className="habit-detail-section-heading"><div><h2 id="weekly-title">Weekly consistency</h2><p>Completed scheduled days per week</p></div></div>
          {snapshot.weeks.length === 0 ? <p className="habit-detail-empty">There isn’t enough scheduled history to show a weekly trend.</p> : (
            <div className="insight-chart-scroll" aria-label="Weekly completion rate chart">
              <div className="insight-chart habit-week-chart" style={{ '--chart-count': snapshot.weeks.length } as CSSProperties}>
                {snapshot.weeks.map((week) => {
                  const rate = Math.round(week.rate * 100)
                  const start = new Date(`${week.startDate}T12:00:00`)
                  const end = new Date(`${week.endDate}T12:00:00`)
                  return <div className="chart-column" key={week.startDate}
                    title={`${dayLabel.format(start)} – ${dayLabel.format(end)} · ${week.completed} of ${week.scheduled} completed`}>
                    <div className="chart-track"><span style={{ height: `${Math.max(rate, 3)}%` }} /></div>
                    <span className="chart-date">{weekLabel.format(start)}</span>
                  </div>
                })}
              </div>
            </div>
          )}
        </section>

        <HabitActivityHeatmap habit={habit} completions={data.completions} endDate={today} weekStartsOn={weekStartsOn} />

        <section className="habit-detail-section" aria-labelledby="history-title">
          <div className="habit-detail-section-heading"><div><h2 id="history-title">Recent history</h2><p>Latest scheduled and unscheduled days</p></div></div>
          {recentHistory.length === 0 ? <p className="habit-detail-empty">No history is available for this period.</p> : <ul className="habit-history-list">
            {recentHistory.map((day) => <li className="habit-history-row" key={day.date}>
              <time dateTime={day.date}>{dayLabel.format(new Date(`${day.date}T12:00:00`))}</time>
              <span className={`habit-history-status is-${day.status}`}>{statusLabel(day.status)}</span>
            </li>)}
          </ul>}
        </section>
      </div>
    </>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="habit-detail-metric"><span className="insight-label">{label}</span><strong>{value}</strong>{detail && <span className="habit-detail-metric-detail">{detail}</span>}</div>
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

function statusLabel(status: 'completed' | 'missed' | 'unscheduled'): string {
  return status === 'completed' ? 'Completed' : status === 'missed' ? 'Missed' : 'Not scheduled'
}
