import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasValidOrigin } from '@/lib/csrf'
import { supabaseUrl, publicSupabaseKey } from '@/lib/supabase/keys'
import { syntheticEmail } from '@/lib/shared-utils'
import { passwordSchema } from '@/lib/validation'
import { logSecurityEvent } from '@/lib/security'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') ?? 'unknown'

  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > 4096) {
    return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = passwordSchema.safeParse((raw as { newPassword?: unknown })?.newPassword)
  const body = raw as { currentPassword?: string; confirmPassword?: string; newPassword?: string }
  if (!parsed.success || body.confirmPassword !== body.newPassword || !body.currentPassword) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 })

  // Проверяем текущий пароль отдельным клиентом без сохранения сессии.
  const verifier = createSupabaseClient(supabaseUrl(), publicSupabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: syntheticEmail(profile.username),
    password: body.currentPassword,
  })
  if (verifyError) {
    return NextResponse.json({ error: 'INVALID_CURRENT_PASSWORD', message: 'Неверный текущий пароль.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: parsed.data,
  })
  if (updateError) {
    return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
  }

  // Отзываем ВСЕ сессии, включая текущую (admin.signOut ждёт JWT).
  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session?.access_token) {
    await admin.auth.admin.signOut(sessionData.session.access_token, 'global')
  }

  logSecurityEvent('password_changed', correlationId)
  return NextResponse.json({ ok: true }, { status: 200 })
}
