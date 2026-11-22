import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const raw = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const query = raw.replace(/^@/, '').toLowerCase()

  if (!query || !/^[a-z0-9]{1,20}$/.test(query)) {
    return NextResponse.json({ users: [] }, { status: 200 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `${query}%`)
    .order('username')
    .limit(10)

  if (error) return NextResponse.json({ error: 'SEARCH_FAILED' }, { status: 500 })
  return NextResponse.json({ users: data ?? [] }, { status: 200 })
}
