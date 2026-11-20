import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { HTTPException } from 'hono/http-exception'

let client: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service-role key.
 * The key bypasses RLS, so it must never reach the browser; every route that
 * uses this client checks the caller's role first.
 */
export function db() {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new HTTPException(500, { message: 'Database is not configured on the server (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' })
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

/** Throws a 500 for a Supabase error, logging the details server-side only. */
export function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) {
    console.error(`[db] ${what}:`, result.error.message)
    throw new HTTPException(500, { message: `Could not ${what}` })
  }
  return result.data
}
