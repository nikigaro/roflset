/**
 * Прямые обращения к NEXT_PUBLIC_* (Next.js инлайнит их statically).
 * Publishable ключ предпочтителен; legacy anon — fallback.
 */
export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  return url
}

export function publicSupabaseKey(): string {
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (publishable) return publishable

  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (anon) return anon

  throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}
