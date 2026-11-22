import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasValidOrigin } from '@/lib/csrf'
import { sendMessageSchema } from '@/lib/validation'
import { logSecurityEvent } from '@/lib/security'
import { isRateLimitAvailable } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 8192

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const rawCursor = new URL(request.url).searchParams.get('cursor')
  let cursor: { createdAt: string; id: number } | null = null

  if (rawCursor) {
    const [createdAt, idPart] = decodeURIComponent(rawCursor).split('|')
    const id = Number(idPart)
    if (!createdAt || !Number.isInteger(id) || id <= 0 || Number.isNaN(Date.parse(createdAt))) {
      return NextResponse.json({ error: 'INVALID_CURSOR' }, { status: 400 })
    }
    cursor = { createdAt, id }
  }

  const { data, error } = await supabase.rpc('chat_page', {
    p_cursor: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: 51,
  })

  if (error || !data) {
    return NextResponse.json({ error: 'HISTORY_FAILED' }, { status: 500 })
  }

  const visible = data.filter((row) => !row.content.startsWith('{"k":"news"'))
  const hasMore = visible.length > 50
  const items = visible.slice(0, 50)
  const last = items[items.length - 1]
  const nextCursor = hasMore && last ? `${last.created_at}|${last.id}` : null

  return NextResponse.json({ messages: items, nextCursor, hasMore }, { status: 200 })
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
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

  const parsed = sendMessageSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message }, { status: 400 })
  }

  if (!isRateLimitAvailable()) {
    return NextResponse.json({ error: 'SERVICE_UNAVAILABLE', message: 'Сервис чата временно недоступен.' }, { status: 503 })
  }

  const admin = createAdminClient()
  const { data: limitData, error: limitError } = await admin.rpc('check_chat_rate_limit', {
    p_user_id: user.id,
  })
  const limit = limitError || !limitData || Array.isArray(limitData) ? null : (limitData as { allowed?: boolean; retry_after?: number })

  if (!limit?.allowed) {
    logSecurityEvent('rate_limit', request.headers.get('x-correlation-id') ?? 'unknown', { scope: 'chat' })
    return NextResponse.json(
      {
        error: 'RATE_LIMITED',
        message: `Слишком много сообщений. Отправка заблокирована на ${limit?.retry_after ?? 60} сек.`,
      },
      { status: 429 },
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  const { data: inserted, error: insertError } = await supabase
    .from('messages')
    .insert({ user_id: user.id, content: parsed.data.content })
    .select('id, content, created_at')
    .single()

  if (insertError || !inserted) {
    return NextResponse.json({ error: 'SEND_FAILED' }, { status: 500 })
  }

  // Фильтр запрещённых слов вынесен в Edge Function (hidden = true).
  const moderationUrl = process.env.MODERATION_FUNCTION_URL
  if (moderationUrl) {
    void fetch(moderationUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
      },
      body: JSON.stringify({ messageId: inserted.id, content: inserted.content }),
    }).catch(() => {
      // Модерация не должна ломать отправку; скрытие придёт realtime-событием UPDATE.
    })
  }

  return NextResponse.json(
    {
      message: {
        id: inserted.id,
        content: inserted.content,
        created_at: inserted.created_at,
        user_id: user.id,
        username: profile?.username ?? 'unknown',
      },
    },
    { status: 201 },
  )
}
