'use client'

import { useCallback, useState, type FormEvent } from 'react'
import Link from 'next/link'
import TurnstileField from '@/components/turnstile-field'
import { usernameSchema, passwordSchema } from '@/lib/validation'

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Проверьте правильность заполнения полей.',
  TURNSTILE_FAILED: 'Проверка Turnstile не пройдена. Попробуйте ещё раз.',
  INVALID_RECOVERY_CODE: 'Неверный юзернейм или recovery-код',
  RATE_LIMITED: 'Слишком много попыток. Попробуйте позже.',
  RECOVERY_FAILED: 'Не удалось сбросить пароль. Попробуйте ещё раз.',
}

export default function RecoverForm() {
  const [username, setUsername] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const handleTokenChange = useCallback((value: string | null) => setToken(value), [])

  const canSubmit =
    usernameSchema.safeParse(username).success &&
    /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(recoveryCode.trim().toUpperCase()) &&
    passwordSchema.safeParse(newPassword).success &&
    Boolean(token) &&
    !busy

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || !token) return

    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username,
          recoveryCode: recoveryCode.trim().toUpperCase(),
          newPassword,
          turnstileToken: token,
        }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string; message?: string }

      if (!response.ok || !payload.ok) {
        setError(payload.message ?? ERROR_MESSAGES[payload.error ?? ''] ?? 'Неизвестная ошибка.')
        setResetSignal((value) => value + 1)
        return
      }

      setDone(true)
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setResetSignal((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-neutral-400 bg-white px-3 py-2 text-black outline-none focus:border-black dark:border-neutral-600 dark:bg-[#1f1f23] dark:text-white dark:focus:border-white'

  if (done) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-neutral-300 bg-white p-8 dark:border-neutral-800 dark:bg-[#1f1f23]">
        <h1 className="mb-4 text-2xl font-semibold text-black dark:text-white">Пароль сброшен</h1>
        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          Все предыдущие сессии отозваны. Войдите с новым паролем.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-full bg-black px-4 py-2.5 font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Перейти ко входу
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-neutral-300 bg-white p-8 dark:border-neutral-800 dark:bg-[#1f1f23]">
      <h1 className="mb-2 text-2xl font-semibold text-black dark:text-white">Восстановление</h1>
      <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        Введите юзернейм, один неиспользованный recovery-код и новый пароль.
      </p>

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
          <label className="block text-sm font-medium text-black dark:text-white" htmlFor="recoveryCode">
            Код восстановления
          </label>
          <input
            id="recoveryCode"
            className={`${inputClass} font-mono uppercase`}
            value={recoveryCode}
            onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            spellCheck={false}
            maxLength={14}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-black dark:text-white" htmlFor="newPassword">
            Новый пароль
          </label>
          <input
            id="newPassword"
            className={inputClass}
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            maxLength={128}
            required
          />
          <p className="text-xs text-neutral-500">Минимум 12 символов: строчная и заглавная буквы, цифра.</p>
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
          {busy ? 'Сброс…' : 'Сбросить пароль'}
        </button>
      </form>
    </div>
  )
}
