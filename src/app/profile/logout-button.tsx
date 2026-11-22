'use client'

import { useState } from 'react'

export default function LogoutButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const logout = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/logout', { method: 'POST' })
      if (!response.ok) {
        setError('Не удалось выйти. Попробуйте ещё раз.')
        return
      }
      window.location.assign('/login')
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-black transition hover:bg-black/10 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
      >
        {busy ? 'Выход…' : 'Выйти'}
      </button>
      {error !== null && (
        <p className="border-l-2 border-black bg-neutral-100 px-3 py-2 text-sm font-medium text-black dark:border-white dark:bg-neutral-900 dark:text-white">
          {error}
        </p>
      )}
    </div>
  )
}
