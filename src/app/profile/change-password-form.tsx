'use client'

import { useState, type FormEvent } from 'react'

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 12 &&
    newPassword === confirmPassword &&
    !busy

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) {
        setError(payload.message ?? 'Не удалось сменить пароль.')
        return
      }
      setDone(true)
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const relogin = async () => {
    await fetch('/api/logout', { method: 'POST' })
    window.location.assign('/login')
  }

  const inputClass =
    'w-full rounded-lg border-0 bg-white px-3 py-2 text-black outline-none placeholder:text-neutral-400 dark:bg-[#26262c] dark:text-white'

  if (done) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-black dark:text-white">Пароль сменён. Все сессии отозваны.</p>
        <button
          type="button"
          onClick={relogin}
          className="rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-black transition hover:bg-black/15 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
        >
          Войти заново
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className={inputClass}
        type="password"
        placeholder="Текущий пароль"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
      />
      <input
        className={inputClass}
        type="password"
        placeholder="Новый пароль"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <input
        className={inputClass}
        type="password"
        placeholder="Повторите новый пароль"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
      />
      {error !== null && <p className="text-sm font-medium text-black dark:text-white">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-black transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
      >
        {busy ? 'Смена…' : 'Сменить пароль'}
      </button>
    </form>
  )
}
