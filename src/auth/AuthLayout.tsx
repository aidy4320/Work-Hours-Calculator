import type { ReactNode } from 'react'

// Accumulating-hours motif: bars fill toward the monthly goal (the product's core idea).
const BARS = 16
const FILLED = 9

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="auth">
      <aside className="auth__brand">
        <div className="brand__mark">
          Hours<span className="dot">.</span>
        </div>

        <div>
          <div className="brand__motif" aria-hidden="true">
            {Array.from({ length: BARS }).map((_, i) => (
              <div key={i} className={'brand__bar' + (i < FILLED ? ' brand__bar--filled' : '')} />
            ))}
          </div>
          <div className="brand__readout">
            128<span> / 160h this month</span>
          </div>
        </div>

        <p className="brand__tagline">Every hour, counted toward your month.</p>
        <div className="brand__foot">Time tracking for freelancers.</div>
      </aside>

      <main className="auth__panel">
        <div className="auth__form">
          <h1 className="auth__title">{title}</h1>
          <p className="auth__subtitle">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  )
}
