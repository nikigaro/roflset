import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'
import { publicSupabaseKey, supabaseUrl } from '@/lib/supabase/keys'
import { authCookieOptions } from '@/lib/supabase/cookie-options'

/** Браузерный клиент. Использует только publishable / anon-key. */
export function createClient() {
  const remember =
    typeof document !== 'undefined' && document.cookie.split('; ').some((item) => item === 'remember=1')
  return createBrowserClient<Database>(supabaseUrl(), publicSupabaseKey(), {
    cookieOptions: authCookieOptions(remember),
  })
}
