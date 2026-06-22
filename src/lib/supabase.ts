import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/db'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in your .env (see .env.example).',
  )
}

// Single shared, fully-typed client for the whole app (PLAN §2).
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
