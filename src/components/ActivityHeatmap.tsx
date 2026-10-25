import type { CSSProperties } from 'react'
import { buildActivityHeatmap, type ActivityDay } from '../domain/activity'
import type { Habit, HabitData } from '../domain/habits'
import type { WeekStartsOn } from '../storage/preferences'

interface ActivityHeatmapProps {
  habits: Habit[]
  completions: HabitData['completions']
  endDate?: Date
  weekStartsOn?: WeekStartsOn
}

const compactDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })
const monthDate = new Intl.DateTimeFormat('en', { month: 'short' })
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function ActivityHeatmap({ habits, completions, endDate = new Date(), weekStartsOn = 0 }: ActivityHeatmapProps) {
  const heatmap = buildActivityHeatmap(habits, completions, endDate, weekStartsOn)
  const weekdayRows = Array.from({ length: 7 }, (_, index) => {
    const day = (weekStartsOn + index) % 7
    return [1, 3, 5].includes(day) ? weekdayLabels[day] : ''
  })
  const months = heatmap.weeks.flatMap((week, weekIndex) => {
    const firstDay = week.find((day): day is ActivityDay => day !== null)
    if (!firstDay) return []
    const date = new Date(`${firstDay.date}T12:00:00`)
    const previousWeek = heatmap.weeks[weekIndex - 1]
    const previousDay = previousWeek ? [...previousWeek].reverse().find((day): day is ActivityDay => day !== null) : undefined
    return date.getMonth() !== (previousDay ? new Date(`${previousDay.date}T12:00:00`).getMonth() : -1)
      ? [{ weekIndex, label: monthDate.format(date) }]
      : []
  })

  return (
    <section className="activity-section" aria-labelledby="activity-title">
      <header className="activity-header">
        <div>
          <h2 id="activity-title">Activity</h2>
          <p>{compactDate.format(new Date(`${heatmap.startDate}T12:00:00`))} — {compactDate.format(new Date(`${heatmap.endDate}T12:00:00`))}</p>
        </div>
        <span className="activity-total">Last 12 months</span>
      </header>

      <div className="activity-scroll" role="group" aria-label="Daily habit activity. Scroll horizontally to view the full year.">
        <div className="heatmap-months" style={{ '--week-count': heatmap.weeks.length } as CSSProperties & { '--week-count': number }} aria-hidden="true">
          {months.map(({ weekIndex, label }) => <span className="heatmap-month" style={{ gridColumn: weekIndex + 2 }} key={`${weekIndex}-${label}`}>{label}</span>)}
        </div>
        <div className="heatmap-layout">
          <div className="heatmap-weekdays" aria-hidden="true">
            {weekdayRows.map((day, index) => <span key={index}>{day}</span>)}
          </div>
          <div className="heatmap-grid" role="grid" aria-label="Habit completion activity over the last 12 months" aria-rowcount={7} aria-colcount={heatmap.weeks.length}>
            {heatmap.weeks.map((week, weekIndex) => (
              <div className="heatmap-week" role="row" aria-label={`Week ${weekIndex + 1}`} key={weekIndex}>
                {week.map((day, dayIndex) => {
                  const date = day ? new Date(`${day.date}T12:00:00`) : null
                  const tooltip = day
                    ? day.scheduled === 0
                      ? `${compactDate.format(date!)} · No habits scheduled`
                      : `${compactDate.format(date!)} · ${day.completed} of ${day.scheduled} habits completed`
                    : ''
                  return (
                    <span
                      className={`heatmap-cell${day ? '' : ' is-outside'}`}
                      data-level={day?.intensity ?? 0}
                      role={day ? 'gridcell' : undefined}
                      aria-label={tooltip || undefined}
                      title={tooltip || undefined}
                      key={day?.date ?? `outside-${weekIndex}-${dayIndex}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="heatmap-legend" aria-label="Activity intensity legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4, 5].map((level) => <span className="heatmap-cell" data-level={level} aria-hidden="true" key={level} />)}
        <span>More</span>
      </footer>
    </section>
  )
}
