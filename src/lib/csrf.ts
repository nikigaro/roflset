/**
 * CSRF для MVP: SameSite=Lax + проверка Origin на все state-changing запросы.
 */
export function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false

  const host = request.headers.get('host')
  if (!host) return false

  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
  const expected = `${protocol}://${host}`
  const configured = process.env.APP_ORIGIN

  try {
    const parsed = new URL(origin)
    return parsed.origin === expected || (configured ? parsed.origin === configured : false)
  } catch {
    return false
  }
}
