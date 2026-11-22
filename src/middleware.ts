import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://challenges.cloudflare.com https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co",
    'frame-src https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
  const csp = buildCsp(nonce)
  const correlationId = crypto.randomUUID()

  // Next.js считывает nonce из request-CSP и проставляет его на свои inline-скрипты.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('content-security-policy', csp)
  requestHeaders.set('x-correlation-id', correlationId)
  if (request.nextUrl.pathname === '/welcome') requestHeaders.set('x-gate', '1')

  const requestWithCsp = new NextRequest(request, { headers: requestHeaders })
  const response = await updateSession(requestWithCsp)

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-correlation-id', correlationId)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (protocol === 'https' || request.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
