'use client'

import { useCallback, useState, type FormEvent } from 'react'
import TurnstileField from '@/components/turnstile-field'
import { isReservedUsername } from '@/lib/username'
import { passwordSchema, usernameSchema } from '@/lib/validation'

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Проверьте правильность заполнения полей.',
  RESERVED_USERNAME: 'Это имя пользователя зарезервировано.',
  TURNSTILE_FAILED: 'Проверка Turnstile не пройдена. Попробуйте ещё раз.',
  RATE_LIMITED: 'Слишком много попыток. Попробуйте позже.',
  REGISTRATION_FAILED: 'Не удалось зарегистрироваться. Попробуйте другой юзернейм или войдите.',
}

export default function RegisterForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [issuedCodes, setIssuedCodes] = useState<string[] | null>(null)
  const [savedAcknowledged, setSavedAcknowledged] = useState(false)

  const handleTokenChange = useCallback((value: string | null) => setToken(value), [])

  const usernameOk = usernameSchema.safeParse(username).success && !isReservedUsername(username)
  const passwordOk = passwordSchema.safeParse(password).success
  const passwordsMatch = password.length > 0 && password === confirmPassword
  const canSubmit = usernameOk && passwordOk && passwordsMatch && Boolean(token) && !busy

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || !token) return

    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          confirmPassword,
          turnstileToken: token,
        }),
      })
      const payload = (await response.json()) as {
        ok?: boolean
        error?: string
        message?: string
        recoveryCodes?: string[]
      }

      if (!response.ok || !payload.ok) {
        setError(payload.message ?? ERROR_MESSAGES[payload.error ?? ''] ?? 'Неизвестная ошибка.')
        setResetSignal((value) => value + 1)
        return
      }

      setIssuedCodes(payload.recoveryCodes ?? [])
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setResetSignal((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }

  const downloadCodes = () => {
    if (!issuedCodes) return
    const text = [
      'РофлСеть — коды восстановления',
      '',
      ...issuedCodes.map((code, index) => `${index + 1}. ${code}`),
      '',
      'Храните этот файл в безопасном месте. Коды показываются только один раз.',
      '',
    ].join('\n')

    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'rofset-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  const inputClass =
    'w-full rounded-lg border border-neutral-400 bg-white px-3 py-2 text-black outline-none focus:border-black dark:border-neutral-600 dark:bg-[#1f1f23] dark:text-white dark:focus:border-white'
  const labelClass = 'block text-sm font-medium text-black dark:text-white'
  const hintClass = 'text-xs text-neutral-500 dark:text-neutral-400'

  if (issuedCodes !== null) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-neutral-300 bg-white p-8 dark:border-neutral-800 dark:bg-[#1f1f23]">
        <h1 className="mb-2 text-2xl font-semibold text-black dark:text-white">Коды восстановления</h1>
        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          Это единственный раз, когда они показываются. Скачайте или скопируйте их сейчас.
        </p>

        <ol className="mb-6 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-black bg-neutral-100 p-4 font-mono text-sm text-black dark:border-white dark:bg-neutral-900 dark:text-white">
          {issuedCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ol>

        <button
          type="button"
          onClick={downloadCodes}
          className="mb-6 w-full rounded-full border border-black px-4 py-2 font-medium text-black transition hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-neutral-900"
        >
          Скачать .txt
        </button>

        <label className="mb-6 flex items-center gap-2 text-sm text-black dark:text-white">
          <input
            type="checkbox"
            checked={savedAcknowledged}
            onChange={(event) => setSavedAcknowledged(event.target.checked)}
            className="h-4 w-4 accent-black dark:accent-white"
          />
          Я сохранил recovery-коды
        </label>

        <button
          type="button"
          disabled={!savedAcknowledged}
          onClick={() => window.location.assign('/profile')}
          className="w-full rounded-full bg-black px-4 py-2.5 font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
        >
          Перейти в профиль
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-neutral-300 bg-white p-8 dark:border-neutral-800 dark:bg-[#1f1f23]">
      <h1 className="mb-6 text-2xl font-semibold text-black dark:text-white">Регистрация</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label className={labelClass} htmlFor="username">
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
            placeholder="user123"
            required
          />
          <p className={hintClass}>3–20 символов: строчные латинские буквы и цифры, первая — буква.</p>
        </div>

        <div className="space-y-1">
          <label className={labelClass} htmlFor="password">
            Пароль
          </label>
          <input
            id="password"
            className={inputClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            maxLength={128}
            required
          />
          <p className={hintClass}>Минимум 12 символов: строчная и заглавная буквы, цифра.</p>
        </div>

        <div className="space-y-1">
          <label className={labelClass} htmlFor="confirmPassword">
            Повторите пароль
          </label>
          <input
            id="confirmPassword"
            className={inputClass}
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
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
          {busy ? 'Регистрация…' : 'Зарегистрироваться'}
        </button>
      </form>
    </div>
  )
}
