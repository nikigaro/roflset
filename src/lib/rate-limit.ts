import { createAdminClient } from '@/lib/supabase/admin'

/** Без service role key лимит проверить нельзя — это конфигурационная ошибка, не флуд. */
export function isRateLimitAvailable(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

export type RateLimitCheck = {
  key: string
  windowSeconds: number
  max: number
}

export const RATE_LIMITS = {
  register: [{ key: 'register', windowSeconds: 3600, max: 3 }],
  login: [
    { key: 'login:ip', windowSeconds: 60, max: 5 },
    { key: 'login:user', windowSeconds: 60, max: 5 },
  ],
  recover: [
    { key: 'recover:ip', windowSeconds: 3600, max: 3 },
    { key: 'recover:user', windowSeconds: 3600, max: 3 },
  ],
} as const

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]
    if (first) return first.trim()
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Возвращает false, если лимит исчерпан ИЛИ БД недоступна (fail closed). */
export async function checkRateLimit(
  request: Request,
  checks: readonly RateLimitCheck[],
  username?: string,
): Promise<boolean> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    // Нет service role key — считаем лимит исчерпанным (fail closed).
    return false
  }

  const ip = clientIp(request)

  for (const check of checks) {
    const key = check.key.endsWith(':user') ? `${check.key}:${username ?? ''}` : check.key
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_ip: ip,
      p_key: key,
      p_window_seconds: check.windowSeconds,
      p_max: check.max,
    })
    if (error || data !== true) return false
  }

  return true
}
