import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in your .env (see .env.example).',
  )
}

// Single shared client for the whole app (PLAN §2).
// TASK-02 will regenerate DB types and switch this to createClient<Database>(...).
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
