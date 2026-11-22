// Supabase Edge Function: фильтр запрещённых слов -> hidden = true.
// Деплой: supabase functions deploy moderate-message
import { createClient } from 'npm:@supabase/supabase-js@2'

const BANNED_WORDS = ['казино', 'мошенничество', 'spam', 'viagra']

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = (await req.json()) as { messageId?: number; content?: string }
    if (!body.messageId || typeof body.content !== 'string') {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 })
    }

    const normalized = body.content.toLowerCase()
    const hidden = BANNED_WORDS.some((word) => normalized.includes(word))

    if (hidden) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error } = await supabase
        .from('messages')
        .update({ hidden: true })
        .eq('id', body.messageId)

      if (error) {
        return Response.json({ error: 'UPDATE_FAILED' }, { status: 500 })
      }
    }

    return Response.json({ hidden }, { status: 200 })
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 })
  }
})
