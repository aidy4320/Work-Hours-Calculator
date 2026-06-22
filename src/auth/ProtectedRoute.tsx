import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) {
    return <div className="auth__panel">Loading…</div>
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
