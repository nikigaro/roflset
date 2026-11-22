import { requireEnv } from '@/lib/env'

type TurnstileVerifyResponse = {
  success: boolean
  challenge_ts?: string
  hostname?: string
  'error-codes'?: string[]
}

/**
 * Проверка токена Turnstile ТОЛЬКО на сервере. Токен одноразовый.
 * Клиентская проверка («widget прошёл») не является доказательством.
 */
export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = requireEnv('TURNSTILE_SECRET_KEY')

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) return false

    const result = (await response.json()) as TurnstileVerifyResponse
    return result.success === true
  } catch {
    return false
  }
}
