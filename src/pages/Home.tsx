import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { Dashboard } from '../components/Dashboard'
import { TimeEntries } from '../components/TimeEntries'

// Authenticated app shell — grows into the full MonthView in TASK-13.
export function Home() {
  const { session } = useAuth()
  const username =
    (session?.user?.user_metadata?.username as string | undefined) ?? session?.user?.email ?? ''
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1

  return (
    <div className="home">
      <div className="home__eyebrow">{username ? `Signed in as ${username}` : 'Signed in'}</div>
      <h1 className="home__title">Your month, in hours</h1>

      <Dashboard year={year} month={month} />

      <div style={{ marginTop: '1.5rem' }}>
        <TimeEntries year={year} month={month} />
      </div>

      <button
        className="btn btn--primary home__signout"
        style={{ marginTop: '2rem' }}
        onClick={() => supabase.auth.signOut()}
      >
        Sign out
      </button>
    </div>
  )
}
