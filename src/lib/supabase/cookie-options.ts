import type { CookieOptionsWithName } from '@supabase/ssr'

/**
 * Сессия живёт только в httpOnly/Secure/SameSite=Lax куках.
 * localStorage для сессии не используется.
 * «Запомнить меня» продлевает срок жизни куки на год.
 */
const BASE: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
}

export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = BASE

export function authCookieOptions(remember: boolean): CookieOptionsWithName {
  return remember ? { ...BASE, maxAge: 60 * 60 * 24 * 365 } : BASE
}
