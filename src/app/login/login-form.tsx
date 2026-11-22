'use client'

import { useCallback, useState, type FormEvent } from 'react'
import TurnstileField from '@/components/turnstile-field'
import { isReservedUsername } from '@/lib/username'
import { usernameSchema } from '@/lib/validation'

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Проверьте правильность заполнения полей.',
  TURNSTILE_FAILED: 'Проверка Turnstile не пройдена. Попробуйте ещё раз.',
  INVALID_CREDENTIALS: 'Неверный юзернейм или пароль',
  RATE_LIMITED: 'Слишком много попыток. Попробуйте позже.',
}

export default function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleTokenChange = useCallback((value: string | null) => setToken(value), [])

  const canSubmit =
    usernameSchema.safeParse(username).success &&
    !isReservedUsername(username) &&
    password.length > 0 &&
    Boolean(token) &&
    !busy

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || !token) return

    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          turnstileToken: token,
        }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }

      if (!response.ok || !payload.ok) {
        setError(ERROR_MESSAGES[payload.error ?? ''] ?? 'Неизвестная ошибка.')
        setResetSignal((value) => value + 1)
        return
      }

      window.location.assign('/profile')
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setResetSignal((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-neutral-400 bg-white px-3 py-2 text-black outline-none focus:border-black dark:border-neutral-600 dark:bg-[#1f1f23] dark:text-white dark:focus:border-white'

  return (
    <div className="w-full max-w-lg rounded-2xl border border-neutral-300 bg-white p-8 dark:border-neutral-800 dark:bg-[#1f1f23]">
      <h1 className="mb-6 text-2xl font-semibold text-black dark:text-white">Вход</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-black dark:text-white" htmlFor="username">
            Имя пользователя
          </label>
          <input
            id="username"
            className={inputClass}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            spellCheck={false}
            maxLength={20}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-black dark:text-white" htmlFor="password">
            Пароль
          </label>
          <input
            id="password"
            className={inputClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </div>

        <TurnstileField onTokenChange={handleTokenChange} resetSignal={resetSignal} />

        {error !== null && (
          <p className="border-l-2 border-black bg-neutral-100 px-3 py-2 text-sm font-medium text-black dark:border-white dark:bg-neutral-900 dark:text-white">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-full bg-black px-4 py-2.5 font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
        >
          {busy ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
