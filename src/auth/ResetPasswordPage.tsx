import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthLayout } from './AuthLayout'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  // 'request' = ask for a reset email; 'update' = set a new password (arrived via the email link)
  const [mode, setMode] = useState<'request' | 'update'>('request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('update')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function requestReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  async function updatePassword(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Use a password of at least 8 characters.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/', { replace: true })
  }

  if (mode === 'update') {
    return (
      <AuthLayout title="Set a new password" subtitle="Choose a password to finish.">
        <form onSubmit={updatePassword} noValidate>
          {error && <div className="form__msg form__msg--error">{error}</div>}
          <div className="field">
            <label className="field__label" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              className="field__input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We’ll email you a reset link.">
      {sent ? (
        <div className="form__msg form__msg--ok">
          If that email has an account, a reset link is on its way.
        </div>
      ) : (
        <form onSubmit={requestReset} noValidate>
          {error && <div className="form__msg form__msg--error">{error}</div>}
          <div className="field">
            <label className="field__label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="field__input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="form__alt">
        Remembered it? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
