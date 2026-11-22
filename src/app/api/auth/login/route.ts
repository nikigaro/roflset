import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syntheticEmail, antiTimingDelay } from '@/lib/shared-utils'
import { loginSchema } from '@/lib/validation'
import { verifyTurnstile } from '@/lib/turnstile'
import { checkRateLimit, isRateLimitAvailable, RATE_LIMITS } from '@/lib/rate-limit'
import { hasValidOrigin } from '@/lib/csrf'
import { logSecurityEvent } from '@/lib/security'
import { establishSession } from '@/lib/session'

export const runtime = 'nodejs'

const INVALID = { error: 'INVALID_CREDENTIALS', message: 'Неверный юзернейм или пароль' }

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') ?? 'unknown'

  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    await antiTimingDelay()
    logSecurityEvent('login_failure', correlationId, { reason: 'INVALID_JSON' })
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    await antiTimingDelay()
    logSecurityEvent('login_failure', correlationId, { reason: 'VALIDATION_ERROR' })
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { username, password, turnstileToken } = parsed.data

  if (!isRateLimitAvailable()) {
    return NextResponse.json({ error: 'SERVICE_UNAVAILABLE', message: 'Сервис входа временно недоступен.' }, { status: 503 })
  }

  if (!(await checkRateLimit(request, RATE_LIMITS.login, username))) {
    logSecurityEvent('rate_limit', correlationId, { scope: 'login' })
    await antiTimingDelay()
    return NextResponse.json({ error: 'RATE_LIMITED', message: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 })
  }

  if (!(await verifyTurnstile(turnstileToken))) {
    logSecurityEvent('login_failure', correlationId, { reason: 'TURNSTILE' })
    await antiTimingDelay()
    return NextResponse.json({ error: 'TURNSTILE_FAILED' }, { status: 400 })
  }

  const admin = createAdminClient()
  const email = syntheticEmail(username)

  // Проверка пароля через SQL-функцию: обычный signInWithPassword заблокирован,
  // если провайдер Email выключен.
  const supabase = await createClient()
  const { data: passwordValid, error: verifyError } = await admin.rpc('verify_user_password', {
    p_email: email,
    p_password: password,
  })

  let authenticated = false

  if (!verifyError) {
    // SQL-функция проверки пароля (работает и при выключенном провайдере Email).
    if (passwordValid !== true) {
      logSecurityEvent('login_failure', correlationId, { reason: 'INVALID_CREDENTIALS' })
      await antiTimingDelay()
      return NextResponse.json(INVALID, { status: 401 })
    }
    authenticated = await establishSession(supabase, admin, email)
  } else {
    // Функция не установлена — обычный вход через Supabase Auth.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    authenticated = !signInError
  }

  if (!authenticated) {
    logSecurityEvent('login_failure', correlationId, { reason: 'SESSION' })
    await antiTimingDelay()
    return NextResponse.json(INVALID, { status: 401 })
  }

  logSecurityEvent('login_success', correlationId)
  return NextResponse.json({ ok: true }, { status: 200 })
}
