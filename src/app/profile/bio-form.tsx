'use client'

import { useState, type FormEvent } from 'react'

type BioFormProps = { initialBio: string }

export default function BioForm({ initialBio }: BioFormProps) {
  const [bio, setBio] = useState(initialBio)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (bio.length > 300 || busy) return
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      const response = await fetch('/api/profile/bio', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bio }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error === 'VALIDATION_ERROR' ? 'Слишком длинный текст или недопустимые символы.' : 'Не удалось сохранить.')
        return
      }
      setSaved(true)
    } catch {
      setError('Сетевая ошибка.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={bio}
        onChange={(event) => setBio(event.target.value.slice(0, 300))}
        maxLength={300}
        rows={3}
        placeholder="Расскажите о себе…"
        className="w-full resize-none rounded-lg border-0 bg-white px-3 py-2 text-black outline-none placeholder:text-neutral-400 dark:bg-[#26262c] dark:text-white"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{bio.length} / 300</span>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-black transition hover:bg-black/10 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
        >
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
      {saved && <p className="text-sm text-black dark:text-white">Сохранено.</p>}
      {error !== null && <p className="text-sm font-medium text-black dark:text-white">{error}</p>}
    </form>
  )
}
