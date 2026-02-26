import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let adminClient: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return !!(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null

  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
    )
  }

  return client
}

// Admin client that bypasses RLS — used only for session cleanup
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
  if (!url || !serviceKey) return getSupabase()

  if (!adminClient) {
    adminClient = createClient(url, serviceKey)
  }

  return adminClient
}
