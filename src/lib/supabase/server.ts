import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'
import { publicSupabaseKey, supabaseUrl } from '@/lib/supabase/keys'
import { authCookieOptions } from '@/lib/supabase/cookie-options'

/**
 * Серверный клиент для Server Components и Route Handlers.
 * Все запросы идут с publishable/anon-key и подчиняются RLS. Service role не используется.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const remember = cookieStore.get('remember')?.value === '1'

  return createServerClient<Database>(supabaseUrl(), publicSupabaseKey(), {
    cookieOptions: authCookieOptions(remember),
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Вызов из Server Component: куки меняет middleware.
        }
      },
    },
  })
}
