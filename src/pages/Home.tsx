import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { Dashboard } from '../components/Dashboard'

// Authenticated app shell — grows into the full MonthView in TASK-13.
export function Home() {
  const { session } = useAuth()
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1

  return (
    <div className="home">
      <div className="home__eyebrow">Signed in</div>
      <h1 className="home__title">Your month, in hours</h1>

      <Dashboard year={year} month={month} />

      <p style={{ color: 'var(--muted)', marginTop: '2rem' }}>
        Time entries and the calendar arrive in the next tasks.
      </p>
      <button className="btn btn--primary home__signout" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
      {session?.user?.email && <p className="form__alt">{session.user.email}</p>}
    </div>
  )
}
