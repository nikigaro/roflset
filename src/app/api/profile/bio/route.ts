import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasValidOrigin } from '@/lib/csrf'

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

  let raw: { bio?: unknown }
  try {
    raw = (await request.json()) as { bio?: unknown }
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  if (typeof raw.bio !== 'string' || raw.bio.length > 300 || /[\u0000-\u001F\u007F-\u009F]/.test(raw.bio)) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { error } = await supabase.auth.updateUser({ data: { bio: raw.bio } })
  if (error) {
    return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
