import { useSummary } from '../hooks/useSummary'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const fmt = (n: number) => Number(n).toFixed(2)

export function Dashboard({ year, month }: { year: number; month: number }) {
  const { data, isLoading, isError } = useSummary(year, month)

  if (isLoading) {
    return <section className="dash dash--muted">Loading your month…</section>
  }
  if (isError || !data) {
    return (
      <section className="dash dash--muted">
        We couldn’t load this month. Refresh to try again.
      </section>
    )
  }

  const percent = Math.round(data.percent_complete)
  const barWidth = Math.min(data.percent_complete, 100)

  return (
    <section className="dash">
      <header className="dash__head">
        <span className="dash__eyebrow">This month</span>
        <h2 className="dash__month">
          {MONTHS[month - 1]} {year}
        </h2>
      </header>

      <div className="dash__figures">
        <div className="figure">
          <div className="figure__num num">{fmt(data.worked_hours)}</div>
          <div className="figure__label">Logged</div>
        </div>
        <div className="figure">
          <div className="figure__num num">{fmt(data.remaining_hours)}</div>
          <div className="figure__label">Remaining</div>
        </div>
        <div className="figure">
          <div className="figure__num num">{fmt(data.target_hours)}</div>
          <div className="figure__label">Target</div>
        </div>
      </div>

      <div
        className="progress"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress__bar" style={{ width: `${barWidth}%` }} />
      </div>

      <p className="progress__meta">
        <span className="num">{percent}%</span> of your goal
        {data.goal_reached && <span className="badge">Goal reached</span>}
      </p>
    </section>
  )
}
