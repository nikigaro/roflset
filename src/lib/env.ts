/**
 * Серверный доступ к переменным окружения.
 * NEXT_PUBLIC_* читаются напрямую в клиентском коде (Next.js инлайнит их на сборке).
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
