import type { ReactNode } from 'react'

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
      <div className="auth__card">
        <aside className="auth__brand">
          <div className="brand__mark">
            Hours<span className="dot">.</span>
          </div>
          <p className="brand__tagline">Every hour, counted toward your month.</p>
        </aside>

        <main className="auth__panel">
          <div className="auth__form">
            <h1 className="auth__title">{title}</h1>
            <p className="auth__subtitle">{subtitle}</p>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
