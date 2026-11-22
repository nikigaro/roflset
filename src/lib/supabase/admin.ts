import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { requireEnv } from '@/lib/env'
import { supabaseUrl } from '@/lib/supabase/keys'

/**
 *SERVER ONLY.* Service role обходит RLS. Используется только для:
 * - записи/чтения recovery_codes;
 * - сброса пароля и отзыва сессий через auth.admin.
 * Никогда не импортируйте этот модуль в клиентский код.
 */
export function createAdminClient() {
  return createClient<Database>(supabaseUrl(), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
