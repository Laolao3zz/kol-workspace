import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function hasSupabaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export function isDemoMode(): boolean {
  return import.meta.env.VITE_USE_DEMO_DATA === 'true' || !hasSupabaseConfig()
}

export function getSupabase(): SupabaseClient {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase env vars. Check .env.local file.')
  }

  client = createClient(url, key)
  return client
}

export default getSupabase
