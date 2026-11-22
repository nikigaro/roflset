import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { publicSupabaseKey, supabaseUrl } from '@/lib/supabase/keys'

function tokenFromLink(actionLink: string): string | null {
  const url = new URL(actionLink)
  return url.searchParams.get('token_hash') ?? url.searchParams.get('token')
}

/**
 * Выдаёт сессию через verifyOtp по magic-link, созданному на сервере.
 * Письмо не отправляется, провайдер Email может быть выключен.
 */
export async function establishSession(
  serverClient: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  email: string,
): Promise<boolean> {
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const actionLink = link.data?.properties?.action_link
  if (!actionLink) return false

  const tokenHash = tokenFromLink(actionLink)
  if (!tokenHash) return false

  const { error } = await serverClient.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  return !error
}

/** Возвращает свежий access_token без сохранения сессии в куках. */
export async function issueSessionToken(admin: SupabaseClient<Database>, email: string): Promise<string | null> {
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const actionLink = link.data?.properties?.action_link
  if (!actionLink) return null
  const tokenHash = tokenFromLink(actionLink)
  if (!tokenHash) return null

  const client = createSupabaseClient(supabaseUrl(), publicSupabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  return error ? null : (data.session?.access_token ?? null)
}
