import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasValidOrigin } from '@/lib/csrf'
import { reportSchema } from '@/lib/validation'
import { logSecurityEvent } from '@/lib/security'

export const runtime = 'nodejs'

export async function POST(request: Request) {
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

  const parsed = reportSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { error } = await supabase.from('reports').insert({
    message_id: parsed.data.messageId,
    reporter_id: user.id,
    reason: parsed.data.reason,
  })

  if (error) {
    if (error.code === '23505' || /duplicate/i.test(error.message)) {
      return NextResponse.json({ error: 'ALREADY_REPORTED', message: 'Вы уже жаловались на это сообщение.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'REPORT_FAILED' }, { status: 500 })
  }

  logSecurityEvent('report_created', request.headers.get('x-correlation-id') ?? 'unknown')
  return NextResponse.json({ ok: true }, { status: 200 })
}
