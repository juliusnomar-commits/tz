import { cookies } from 'next/headers'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase public configuration is missing')
  return { url, key }
}

export async function userClient() {
  const { url, key } = config()
  const store = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll() },
      setAll(items) {
        try { items.forEach(({ name, value, options }) => store.set(name, value, options)) }
        catch { /* Server Components cannot write cookies; proxy refreshes them. */ }
      },
    },
  })
}

export function adminClient(): SupabaseClient {
  const { url } = config()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Supabase service role key is missing')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
