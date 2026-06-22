// auth-login — sign in by username + password (Supabase authenticates by email).
// Resolves username -> email server-side (service role), signs in with the anon
// client, and returns the session tokens. Returns a generic error for any
// failure so usernames/emails can't be enumerated. Deployed with --no-verify-jwt.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const admin = createClient(URL, SERVICE_ROLE, { auth: { persistSession: false } })

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const INVALID = { error: 'Invalid username or password' }

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const { username, password } = await req.json().catch(() => ({}))
  if (!username || !password) return json(INVALID, 401)

  // username -> user_id -> email (service role bypasses RLS)
  const { data: profile } = await admin
    .from('profiles')
    .select('user_id')
    .ilike('username', username)
    .maybeSingle()
  if (!profile) return json(INVALID, 401)

  const { data: userRes } = await admin.auth.admin.getUserById(profile.user_id)
  const email = userRes?.user?.email
  if (!email) return json(INVALID, 401)

  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error || !data.session) return json(INVALID, 401)

  return json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  })
})
