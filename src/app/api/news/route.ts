import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasValidOrigin } from '@/lib/csrf'

export const runtime = 'nodejs'

type NewsItem = {
  id: number
  title: string
  version: string
  text: string
  created_at: string
  username: string
}

function parseNews(content: string): Omit<NewsItem, 'id' | 'created_at' | 'username'> | null {
  try {
    const parsed = JSON.parse(content) as { k?: string; title?: string; v?: string; text?: string }
    if (
      parsed.k !== 'news' ||
      typeof parsed.title !== 'string' ||
      typeof parsed.v !== 'string' ||
      typeof parsed.text !== 'string'
    ) {
      return null
    }
    return { title: parsed.title, version: parsed.v, text: parsed.text }
  } catch {
    return null
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await supabase.rpc('chat_page', { p_limit: 50 })
  if (error || !data) return NextResponse.json({ error: 'LOAD_FAILED' }, { status: 500 })

  const items: NewsItem[] = data
    .map((row) => {
      const news = parseNews(row.content)
      return news ? { ...news, id: row.id, created_at: row.created_at, username: row.username } : null
    })
    .filter((item): item is NewsItem => item !== null)

  return NextResponse.json({ news: items }, { status: 200 })
}

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

  let raw: { title?: unknown; version?: unknown; text?: unknown }
  try {
    raw = (await request.json()) as typeof raw
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const version = typeof raw.version === 'string' ? raw.version.trim() : ''
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''

  if (
    !title || title.length > 120 ||
    !version || version.length > 20 ||
    !text || text.length > 1500 ||
    /[\u0000-\u001F\u007F-\u009F]/.test(`${title}${version}${text}`)
  ) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { error } = await supabase.from('messages').insert({
    user_id: user.id,
    content: JSON.stringify({ k: 'news', title, v: version, text, i: [] }),
  })

  if (error) return NextResponse.json({ error: 'CREATE_FAILED' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
