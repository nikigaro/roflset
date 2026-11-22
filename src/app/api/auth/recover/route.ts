import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyRecoveryCode } from '@/lib/recovery-codes'
import { recoverSchema } from '@/lib/validation'
import { antiTimingDelay, syntheticEmail } from '@/lib/shared-utils'
import { verifyTurnstile } from '@/lib/turnstile'
import { checkRateLimit, isRateLimitAvailable, RATE_LIMITS } from '@/lib/rate-limit'
import { hasValidOrigin } from '@/lib/csrf'
import { logSecurityEvent } from '@/lib/security'
import { issueSessionToken } from '@/lib/session'

export const runtime = 'nodejs'

const INVALID = { error: 'INVALID_RECOVERY_CODE', message: 'Неверный юзернейм или recovery-код' }

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') ?? 'unknown'
  const fail = async (reason: string) => {
    logSecurityEvent('recover_failure', correlationId, { reason })
    await antiTimingDelay()
    return NextResponse.json(INVALID, { status: 400 })
  }

  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return fail('INVALID_JSON')
  }

  const parsed = recoverSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('VALIDATION_ERROR')
  }

  const { username, recoveryCode, newPassword, turnstileToken } = parsed.data

  if (!isRateLimitAvailable()) {
    return NextResponse.json({ error: 'SERVICE_UNAVAILABLE', message: 'Сервис восстановления временно недоступен.' }, { status: 503 })
  }

  if (!(await checkRateLimit(request, RATE_LIMITS.recover, username))) {
    logSecurityEvent('rate_limit', correlationId, { scope: 'recover' })
    await antiTimingDelay()
    return NextResponse.json({ error: 'RATE_LIMITED', message: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 })
  }

  if (!(await verifyTurnstile(turnstileToken))) {
    return fail('TURNSTILE')
  }

  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
  if (!profile) return fail('UNKNOWN_USER')

  const { data: codes } = await admin
    .from('recovery_codes')
    .select('id, code_hash')
    .eq('user_id', profile.id)
    .is('used_at', null)

  if (!codes || codes.length === 0) return fail('NO_CODES')

  // Сравниваем со всеми кодами без раннего выхода.
  let matchedId: number | null = null
  for (const row of codes) {
    if (verifyRecoveryCode(recoveryCode, row.code_hash)) matchedId = row.id
  }

  if (matchedId === null) return fail('INVALID_CODE')

  // Атомарная пометка: повтор того же кода даст 400.
  const { data: consumed } = await admin
    .from('recovery_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', matchedId)
    .is('used_at', null)
    .select('id')
    .maybeSingle()

  if (!consumed) return fail('CODE_REUSED')

  const { error: passwordError } = await admin.auth.admin.updateUserById(profile.id, { password: newPassword })
  if (passwordError) {
    logSecurityEvent('recover_failure', correlationId, { reason: 'PASSWORD_UPDATE' })
    return NextResponse.json({ error: 'RECOVERY_FAILED' }, { status: 500 })
  }

  // Получаем свежий JWT через серверный magic-link и отзываем все сессии.
  const accessToken = await issueSessionToken(admin, syntheticEmail(username))
  if (accessToken) {
    await admin.auth.admin.signOut(accessToken, 'global')
  }

  logSecurityEvent('recover_success', correlationId)
  return NextResponse.json({ ok: true }, { status: 200 })
}
