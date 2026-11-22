import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasValidOrigin } from '@/lib/csrf'
import { supabaseUrl } from '@/lib/supabase/keys'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 8 * 1024 * 1024
const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_FILES = 3

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

  const files = formData.getAll('images').filter((item): item is File => item instanceof File)
  if (files.length === 0 || files.length > MAX_FILES) {
    return NextResponse.json({ error: 'INVALID_FILES' }, { status: 400 })
  }

  const admin = createAdminClient()
  const urls: string[] = []

  for (const file of files) {
    if (file.type !== 'image/webp' || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'INVALID_FILES' }, { status: 400 })
    }
    const path = `${user.id}/${randomUUID()}.webp`
    const { error } = await admin.storage.from('posts').upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: 'image/webp',
    })
    if (error) return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 })
    urls.push(`${supabaseUrl()}/storage/v1/object/public/posts/${path}`)
  }

  return NextResponse.json({ ok: true, urls }, { status: 200 })
}
