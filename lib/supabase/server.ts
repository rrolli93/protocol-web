import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase'

export async function createSupabaseServer() {
  const jar = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            jar.set(cookie.name, cookie.value, cookie.options)
          }
        } catch {
          // Server Components cannot always write cookies.
        }
      },
    },
  })
}
