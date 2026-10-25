import type { CSSProperties } from 'react'
import { buildActivityHeatmap, type ActivityDay } from '../domain/activity'
import { getHabitStartDateKey, isHabitActiveOnDate, type Habit, type HabitData } from '../domain/habits'
import type { WeekStartsOn } from '../storage/preferences'

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short' })
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function HabitActivityHeatmap({ habit, completions, endDate, weekStartsOn }: {
  habit: Habit
  completions: HabitData['completions']
  endDate: Date
  weekStartsOn: WeekStartsOn
}) {
  const heatmap = buildActivityHeatmap([habit], completions, endDate, weekStartsOn)
  const startDate = getHabitStartDateKey(habit)
  const weekdayRows = Array.from({ length: 7 }, (_, index) => {
    const weekday = (weekStartsOn + index) % 7
    return [1, 3, 5].includes(weekday) ? weekdayLabels[weekday] : ''
  })
  const months = heatmap.weeks.flatMap((week, weekIndex) => {
    const firstDay = week.find((day): day is ActivityDay => day !== null)
    if (!firstDay) return []
    const currentMonth = new Date(`${firstDay.date}T12:00:00`).getMonth()
    const previousWeek = heatmap.weeks[weekIndex - 1]
    const lastPreviousDay = previousWeek ? [...previousWeek].reverse().find((day): day is ActivityDay => day !== null) : undefined
    const previousMonth = lastPreviousDay ? new Date(`${lastPreviousDay.date}T12:00:00`).getMonth() : -1
    return currentMonth !== previousMonth ? [{ weekIndex, label: monthFormat.format(new Date(`${firstDay.date}T12:00:00`)) }] : []
  })

  function describe(day: ActivityDay | null): string {
    if (!day) return ''
    const date = new Date(`${day.date}T12:00:00`)
    const label = dateFormat.format(date)
    if (startDate && day.date < startDate) return `${label} · Before this habit started`
    if (!isHabitActiveOnDate(habit, day.date)) return `${label} · Habit not active`
    if (!day.scheduled) return `${label} · Not scheduled`
    return `${label} · ${day.completed ? 'Completed' : 'Missed'}`
  }

  return (
    <section className="habit-activity" aria-labelledby="habit-activity-title">
      <div className="habit-detail-section-heading">
        <div><h2 id="habit-activity-title">Activity</h2><p>Daily history over the last 12 months</p></div>
        <div className="habit-activity-legend" aria-label="Activity legend">
          <span><i className="habit-activity-swatch is-completed" />Completed</span>
          <span><i className="habit-activity-swatch is-missed" />Missed</span>
          <span><i className="habit-activity-swatch" />Not scheduled</span>
        </div>
      </div>
      <div className="activity-scroll" role="group" aria-label="Habit activity over the last 12 months. Scroll horizontally to view the full year.">
        <div className="heatmap-months" style={{ '--week-count': heatmap.weeks.length } as CSSProperties & { '--week-count': number }} aria-hidden="true">
          {months.map(({ weekIndex, label }) => <span className="heatmap-month" style={{ gridColumn: weekIndex + 2 }} key={`${weekIndex}-${label}`}>{label}</span>)}
        </div>
        <div className="habit-heatmap-layout">
          <div className="heatmap-weekdays" aria-hidden="true">{weekdayRows.map((label, index) => <span key={index}>{label}</span>)}</div>
          <div className="heatmap-grid" role="grid" aria-label={`${habit.name} activity history`} aria-rowcount={7} aria-colcount={heatmap.weeks.length}>
            {heatmap.weeks.map((week, weekIndex) => <div className="heatmap-week" role="row" aria-label={`Week ${weekIndex + 1}`} key={weekIndex}>
              {week.map((day, dayIndex) => {
                const status = day && startDate && day.date < startDate
                  ? 'before-start'
                  : day && !isHabitActiveOnDate(habit, day.date)
                    ? 'inactive'
                    : day?.scheduled ? day.completed ? 'completed' : 'missed' : 'unscheduled'
                const level = status === 'completed' ? 5 : status === 'missed' ? 1 : 0
                const description = describe(day)
                return <span className={`heatmap-cell habit-heatmap-cell${day ? '' : ' is-outside'}${status === 'inactive' || status === 'before-start' ? ' is-inactive-date' : ''}`}
                  data-level={level} role={day ? 'gridcell' : undefined} aria-label={description || undefined}
                  title={description || undefined} key={day?.date ?? `blank-${weekIndex}-${dayIndex}`} />
              })}
            </div>)}
          </div>
        </div>
      </div>
    </section>
  )
}
