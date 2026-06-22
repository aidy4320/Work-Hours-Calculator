import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

// Placeholder for the authenticated app shell — replaced by MonthView in TASK-13.
export function Home() {
  const { session } = useAuth()
  return (
    <div className="home">
      <div className="home__eyebrow">Signed in</div>
      <h1 className="home__title">Your month, in hours</h1>
      <div className="home__row">
        <span>Logged this month</span>
        <span className="home__readout num">
          0.00<span style={{ color: 'var(--muted)' }}> h</span>
        </span>
      </div>
      <p style={{ color: 'var(--muted)' }}>
        The dashboard, time entries and calendar arrive in the next tasks.
      </p>
      <button className="btn btn--primary" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
      {session?.user?.email && <p className="form__alt">{session.user.email}</p>}
    </div>
  )
}
