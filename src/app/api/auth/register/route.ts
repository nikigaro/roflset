import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRecoveryCodes, hashRecoveryCodes } from '@/lib/recovery-codes'
import { isReservedUsername } from '@/lib/username'
import { syntheticEmail, antiTimingDelay } from '@/lib/shared-utils'
import { registerSchema } from '@/lib/validation'
import { verifyTurnstile } from '@/lib/turnstile'
import { checkRateLimit, isRateLimitAvailable, RATE_LIMITS } from '@/lib/rate-limit'
import { hasValidOrigin } from '@/lib/csrf'
import { logSecurityEvent } from '@/lib/security'
import { establishSession } from '@/lib/session'

export const runtime = 'nodejs'

const NEUTRAL_ERROR = 'Не удалось зарегистрироваться. Попробуйте другой юзернейм или войдите'

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') ?? 'unknown'

  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    logSecurityEvent('register_failure', correlationId, { reason: 'INVALID_JSON' })
    await antiTimingDelay()
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) {
    logSecurityEvent('register_failure', correlationId, { reason: 'VALIDATION_ERROR' })
    await antiTimingDelay()
    return NextResponse.json({ error: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { username, password, turnstileToken } = parsed.data

  if (!isRateLimitAvailable()) {
    return NextResponse.json(
      { error: 'SERVICE_UNAVAILABLE', message: 'Сервис регистрации временно недоступен. Попробуйте позже.' },
      { status: 503 },
    )
  }

  if (!(await checkRateLimit(request, RATE_LIMITS.register))) {
    logSecurityEvent('rate_limit', correlationId, { scope: 'register' })
    await antiTimingDelay()
    return NextResponse.json({ error: 'RATE_LIMITED', message: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 })
  }

  if (isReservedUsername(username)) {
    logSecurityEvent('register_failure', correlationId, { reason: 'RESERVED_USERNAME' })
    await antiTimingDelay()
    return NextResponse.json({ error: 'RESERVED_USERNAME' }, { status: 400 })
  }

  if (!(await verifyTurnstile(turnstileToken))) {
    logSecurityEvent('register_failure', correlationId, { reason: 'TURNSTILE' })
    await antiTimingDelay()
    return NextResponse.json({ error: 'TURNSTILE_FAILED' }, { status: 400 })
  }

  const admin = createAdminClient()
  const email = syntheticEmail(username)

  // Создаём пользователя через Admin API: провайдер Email может быть выключен.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  })

  if (createError || !created.user) {
    logSecurityEvent('register_failure', correlationId, { reason: 'SIGNUP' })
    await antiTimingDelay()
    return NextResponse.json({ error: 'REGISTRATION_FAILED', message: NEUTRAL_ERROR }, { status: 400 })
  }

  const supabase = await createClient()
  if (!(await establishSession(supabase, admin, email))) {
    logSecurityEvent('register_failure', correlationId, { reason: 'SESSION' })
    await antiTimingDelay()
    return NextResponse.json({ error: 'REGISTRATION_FAILED', message: NEUTRAL_ERROR }, { status: 400 })
  }

  const codes = generateRecoveryCodes()
  const { hashes } = hashRecoveryCodes(codes)
  const { error: insertError } = await admin.from('recovery_codes').insert(
    hashes.map((code_hash) => ({ user_id: created.user.id, code_hash })),
  )

  if (insertError) {
    logSecurityEvent('register_failure', correlationId, { reason: 'RECOVERY_CODES' })
    await supabase.auth.signOut()
    await antiTimingDelay()
    return NextResponse.json({ error: 'REGISTRATION_FAILED', message: NEUTRAL_ERROR }, { status: 500 })
  }

  logSecurityEvent('register_success', correlationId)
  return NextResponse.json({ ok: true, recoveryCodes: codes }, { status: 200 })
}
