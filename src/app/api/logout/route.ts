import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasValidOrigin } from '@/lib/csrf'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }

  const supabase = await createClient()
  await supabase.auth.signOut()

  // Дополнительно удаляем все служебные куки Supabase, включая возможные остатки.
  const cookieStore = await cookies()
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      cookieStore.delete(cookie.name)
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
