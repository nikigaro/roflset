import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'
import { publicSupabaseKey, supabaseUrl } from '@/lib/supabase/keys'
import { authCookieOptions } from '@/lib/supabase/cookie-options'

type CookieToSet = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

/** Обновляет сессию и закрывает защищённые маршруты. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let pendingCookies: CookieToSet[] = []
  const remember = request.cookies.get('remember')?.value === '1'

  const supabase = createServerClient<Database>(
    supabaseUrl(),
    publicSupabaseKey(),
    {
      cookieOptions: authCookieOptions(remember),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies = cookiesToSet
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        },
      },
    },
  )

  // getUser() (не getSession()) — доверяем проверку токена серверу.
  const { data, error } = await supabase.auth.getUser()
  const user = error ? null : data.user

  const applyCookies = (response: NextResponse): NextResponse => {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })
    return response
  }

  const pathname = request.nextUrl.pathname
  const isPublic =
    pathname.startsWith('/api/') ||
    ['/welcome', '/login', '/register', '/recover', '/rules'].some((prefix) => pathname.startsWith(prefix))

  if (!user && !isPublic) {
    const welcomeUrl = request.nextUrl.clone()
    welcomeUrl.pathname = '/welcome'
    welcomeUrl.search = ''
    return applyCookies(NextResponse.redirect(welcomeUrl))
  }

  if (user && pathname === '/welcome') {
    const chatUrl = request.nextUrl.clone()
    chatUrl.pathname = '/chat'
    chatUrl.search = ''
    return applyCookies(NextResponse.redirect(chatUrl))
  }

  return applyCookies(NextResponse.next({ request }))
}
