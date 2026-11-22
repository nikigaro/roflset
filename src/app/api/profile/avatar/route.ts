import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasValidOrigin } from '@/lib/csrf'
import { logSecurityEvent } from '@/lib/security'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 8 * 1024 * 1024
const MAX_AVATAR_BYTES = 1024 * 1024

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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const file = formData.get('avatar')
  if (!(file instanceof File) || file.type !== 'image/webp' || file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'INVALID_FILE', message: 'Нужен WebP-файл до 1 МБ.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const path = `${user.id}/avatar.webp`
  const { error } = await admin.storage.from('avatars').upload(
    path,
    new Uint8Array(await file.arrayBuffer()),
    { upsert: true, contentType: 'image/webp' },
  )

  if (error) {
    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 })
  }

  const { data: publicUrl } = admin.storage.from('avatars').getPublicUrl(path)
  logSecurityEvent('avatar_updated', request.headers.get('x-correlation-id') ?? 'unknown')

  return NextResponse.json({ ok: true, avatarUrl: publicUrl.publicUrl }, { status: 200 })
}
