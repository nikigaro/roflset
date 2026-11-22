import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasValidOrigin } from '@/lib/csrf'
import { logSecurityEvent } from '@/lib/security'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  let raw: { messageId?: unknown }
  try {
    raw = (await request.json()) as typeof raw
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const messageId = Number(raw.messageId)
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('messages').delete().eq('id', messageId)
  if (error) return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })

  logSecurityEvent('content_deleted', request.headers.get('x-correlation-id') ?? 'unknown')
  return NextResponse.json({ ok: true }, { status: 200 })
}
