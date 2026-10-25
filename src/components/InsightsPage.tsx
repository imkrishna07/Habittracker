import { useMemo, useState, type CSSProperties } from 'react'
import type { HabitData } from '../domain/habits'
import { calculateInsights, type InsightRange } from '../domain/insights'

const ranges: { id: InsightRange; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'all', label: 'All time' },
]

const dateLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const fullDateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export function InsightsPage({ data, today, onCreateHabit }: { data: HabitData; today: Date; onCreateHabit: () => void }) {
  const [range, setRange] = useState<InsightRange>('30d')
  const snapshot = useMemo(() => calculateInsights(data, range, today), [data, range, today])
  const hasHabits = data.habits.some((habit) => !habit.archived)

  return (
    <>
      <section className="welcome-section insights-heading" aria-labelledby="page-title">
        <p className="eyebrow">YOUR PRACTICE</p>
        <h1 id="page-title">Insights</h1>
        <p className="welcome-copy">A little perspective on what you return to.</p>
      </section>

      {!hasHabits ? (
        <section className="insights-empty">
          <p>Your insights will take shape as you build a practice.</p>
          <button className="button button-secondary" type="button" onClick={onCreateHabit}>Create your first habit</button>
        </section>
      ) : (
        <div className="insights-content">
          <div className="insights-controls" aria-label="Select time range">
            {ranges.map((option) => (
              <button key={option.id} type="button" className={`insight-range-button${range === option.id ? ' is-selected' : ''}`}
                aria-pressed={range === option.id} onClick={() => setRange(option.id)}>{option.label}</button>
            ))}
          </div>

          <section className="insight-overview" aria-label="Overview">
            <div className="insight-primary-metric">
              <span className="insight-label">COMPLETION RATE</span>
              <strong>{formatPercent(snapshot.completionRate)}</strong>
              <span className="insight-caption">{snapshot.scheduledOccurrences ? `${snapshot.completedOccurrences} of ${snapshot.scheduledOccurrences} scheduled` : 'No scheduled habits in this period'}</span>
            </div>
            <div className="insight-secondary-metrics">
              <Metric label="COMPLETIONS" value={String(snapshot.completedOccurrences)} />
              <Metric label="BEST CURRENT STREAK" value={`${snapshot.bestCurrentStreak} ${snapshot.bestCurrentStreak === 1 ? 'day' : 'days'}`} />
              <Metric label="LONGEST STREAK" value={`${snapshot.longestStreak} ${snapshot.longestStreak === 1 ? 'day' : 'days'}`} />
            </div>
          </section>

          {snapshot.scheduledOccurrences === 0 ? (
            <p className="insight-no-data" role="status">There were no scheduled habit occurrences during this range.</p>
          ) : (
            <>
              <section className="insight-section" aria-labelledby="activity-title">
                <div className="insight-section-heading"><div><h2 id="activity-title">Daily activity</h2><p>Completion rate on scheduled days</p></div></div>
                <DailyChart days={snapshot.days} />
              </section>
              <section className="insight-section" aria-labelledby="consistency-title">
                <div className="insight-section-heading"><div><h2 id="consistency-title">Habit consistency</h2><p>Completed habits compared with scheduled occurrences</p></div></div>
                <ul className="consistency-list">
                  {snapshot.habits.map(({ habit, completed, scheduled, rate }) => (
                    <li className="consistency-row" key={habit.id}>
                      <div className="consistency-label"><span>{habit.name}</span><span className="consistency-count">{completed} / {scheduled}</span></div>
                      <div className="consistency-track" role="progressbar" aria-label={`${habit.name} completion rate`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((rate ?? 0) * 100)}>
                        <span style={{ width: `${(rate ?? 0) * 100}%` }} />
                      </div>
                      <span className="consistency-percent">{formatPercent(rate)}</span>
                    </li>
                  ))}
                </ul>
                <div className="consistency-highlights">
                  <p><span>Most consistent</span><strong>{snapshot.mostConsistent ? `${snapshot.mostConsistent.habit.name} · ${formatPercent(snapshot.mostConsistent.rate)}` : '—'}</strong></p>
                  <p><span>Least consistent</span><strong>{snapshot.leastConsistent ? `${snapshot.leastConsistent.habit.name} · ${formatPercent(snapshot.leastConsistent.rate)}` : 'Not enough history to compare'}</strong></p>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="insight-metric"><span className="insight-label">{label}</span><strong>{value}</strong></div>
}

function DailyChart({ days }: { days: ReturnType<typeof calculateInsights>['days'] }) {
  const step = days.length <= 10 ? 1 : days.length <= 40 ? 5 : 14
  return (
    <div className="insight-chart-scroll" aria-label="Daily completion chart">
      <div className="insight-chart" style={{ '--chart-count': days.length } as CSSProperties}>
        {days.map((day, index) => {
          const date = new Date(`${day.date}T12:00:00`)
          const percent = day.rate === null ? 0 : Math.round(day.rate * 100)
          return <div className="chart-column" key={day.date} title={`${fullDateLabel.format(date)} · ${day.completed} of ${day.scheduled} completed`}>
            <div className="chart-track"><span className={day.rate === null ? 'is-inactive' : ''} style={{ height: `${day.rate === null ? 0 : Math.max(percent, day.scheduled ? 3 : 0)}%` }} /></div>
            <span className="chart-date">{index % step === 0 || index === days.length - 1 ? dateLabel.format(date) : ''}</span>
          </div>
        })}
      </div>
    </div>
  )
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}
