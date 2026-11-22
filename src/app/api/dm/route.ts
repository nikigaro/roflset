import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasValidOrigin } from '@/lib/csrf'
import { supabaseUrl } from '@/lib/supabase/keys'
import { usernameSchema } from '@/lib/validation'

export const runtime = 'nodejs'

type DmPayload = { k: 'dm'; to: string; text: string; images: string[] }

const POSTS_PREFIX = `${supabaseUrl()}/storage/v1/object/public/posts/`

function parseDm(content: string): DmPayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<DmPayload>
    if (parsed.k !== 'dm' || typeof parsed.to !== 'string' || typeof parsed.text !== 'string' || !Array.isArray(parsed.images)) {
      return null
    }
    return { k: 'dm', to: parsed.to, text: parsed.text, images: parsed.images.filter((u): u is string => typeof u === 'string') }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const withUsername = new URL(request.url).searchParams.get('with')?.replace(/^@/, '') ?? ''
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('messages')
    .select('id, user_id, content, created_at')
    .eq('hidden', true)
    .order('created_at', { ascending: false })
    .limit(300)

  type DmRow = { id: number; user_id: string; content: string; created_at: string }
  const dms = (rows ?? [])
    .map((row) => ({ row, dm: parseDm(row.content) }))
    .filter((item): item is { row: DmRow; dm: DmPayload } => item.dm !== null)
    .filter((item) => item.row.user_id === user.id || item.dm.to === user.id)

  const partnerIds = [...new Set(dms.map((item) => (item.row.user_id === user.id ? item.dm.to : item.row.user_id)))]
  const { data: profiles } = partnerIds.length > 0
    ? await admin.from('profiles').select('id, username').in('id', partnerIds)
    : { data: [] }
  const names = new Map((profiles ?? []).map((p) => [p.id, p.username]))

  const all = dms.map((item) => ({
    id: item.row.id,
    from_me: item.row.user_id === user.id,
    partner_id: item.row.user_id === user.id ? item.dm.to : item.row.user_id,
    partner: names.get(item.row.user_id === user.id ? item.dm.to : item.row.user_id) ?? 'unknown',
    text: item.dm.text,
    images: item.dm.images,
    created_at: item.row.created_at,
  }))

  if (withUsername) {
    return NextResponse.json({ messages: all.filter((m) => m.partner === withUsername).reverse() }, { status: 200 })
  }

  const conversations = [...new Map(all.map((m) => [m.partner_id, m])).values()].map((m) => ({
    username: m.partner,
    lastText: m.text,
    lastAt: m.created_at,
  }))

  return NextResponse.json({ conversations }, { status: 200 })
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > 8192) {
    return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let raw: { to?: unknown; text?: unknown; images?: unknown }
  try {
    raw = (await request.json()) as typeof raw
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const to = typeof raw.to === 'string' ? raw.to.replace(/^@/, '') : ''
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  const images = Array.isArray(raw.images) ? raw.images.filter((u): u is string => typeof u === 'string') : []

  if (
    !usernameSchema.safeParse(to).success ||
    text.length > 1200 ||
    (!text && images.length === 0) ||
    images.length > 3 ||
    !images.every((url) => url.startsWith(POSTS_PREFIX)) ||
    /[\u0000-\u001F\u007F-\u009F]/.test(text)
  ) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: recipient } = await admin.from('profiles').select('id').eq('username', to).maybeSingle()
  if (!recipient || recipient.id === user.id) {
    return NextResponse.json({ error: 'UNKNOWN_USER' }, { status: 400 })
  }

  const { error } = await admin.from('messages').insert({
    user_id: user.id,
    hidden: true,
    content: JSON.stringify({ k: 'dm', to: recipient.id, text, images }),
  })

  if (error) return NextResponse.json({ error: 'SEND_FAILED' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
