'use client'

import { useEffect, useState, type FormEvent } from 'react'

type NewsItem = {
  id: number
  title: string
  version: string
  text: string
  created_at: string
  username: string
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function NewsClient({ isAdmin }: { isAdmin: boolean }) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [title, setTitle] = useState('')
  const [version, setVersion] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const response = await fetch('/api/news')
      const payload = (await response.json()) as { news?: NewsItem[] }
      if (response.ok) {
        const items = payload.news ?? []
        setNews(items)
        const latest = items[0]?.created_at
        if (latest) localStorage.setItem('news:seen', latest)
      }
    } catch {
      setError('Не удалось загрузить новости.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/news', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, version, text }),
      })
      if (!response.ok) {
        setError('Не удалось опубликовать новость.')
        return
      }
      setTitle('')
      setVersion('')
      setText('')
      await load()
    } catch {
      setError('Сетевая ошибка.')
    } finally {
      setBusy(false)
    }
  }

  const deleteNews = async (id: number) => {
    try {
      const response = await fetch('/api/moderation/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId: id }),
      })
      if (!response.ok) {
        setError('Не удалось удалить новость.')
        return
      }
      setNews((previous) => previous.filter((item) => item.id !== id))
    } catch {
      setError('Сетевая ошибка.')
    }
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <form onSubmit={publish} className="space-y-3 rounded-2xl border border-neutral-300 bg-white p-5 dark:border-neutral-800 dark:bg-[#1f1f23]">
          <h2 className="text-lg font-semibold text-black dark:text-white">Новая новость</h2>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Название"
            className="w-full rounded-lg border border-neutral-400 bg-white px-3 py-2 text-black outline-none dark:border-neutral-600 dark:bg-[#26262c] dark:text-white"
          />
          <input
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            maxLength={20}
            placeholder="Версия (например v2)"
            className="w-full rounded-lg border border-neutral-400 bg-white px-3 py-2 text-black outline-none dark:border-neutral-600 dark:bg-[#26262c] dark:text-white"
          />
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={1500}
            rows={4}
            placeholder="Текст новости"
            className="w-full resize-none rounded-lg border border-neutral-400 bg-white px-3 py-2 text-black outline-none dark:border-neutral-600 dark:bg-[#26262c] dark:text-white"
          />
          {error !== null && <p className="text-sm font-medium text-black dark:text-white">{error}</p>}
          <button
            type="submit"
            disabled={busy || !title || !version || !text}
            className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {busy ? 'Публикация…' : 'Опубликовать'}
          </button>
        </form>
      )}

      {news.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">Новостей пока нет.</p>
      ) : (
        news.map((item) => (
          <article key={item.id} className="rounded-2xl border border-neutral-300 bg-white p-5 dark:border-neutral-800 dark:bg-[#1f1f23]">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xl font-semibold text-black dark:text-white">{item.title}</h2>
              <span className="rounded-full border border-neutral-400 px-2 py-0.5 text-xs text-neutral-600 dark:border-neutral-600 dark:text-neutral-300">
                {item.version}
              </span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm text-black dark:text-white">{item.text}</p>
            <div className="mt-4 flex items-center gap-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                @{item.username} · <time suppressHydrationWarning dateTime={item.created_at}>{formatTime(item.created_at)}</time>
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => void deleteNews(item.id)}
                  className="ml-auto rounded-full border border-red-500 px-3 py-1 text-xs text-red-500 transition hover:bg-red-500/10"
                >
                  Удалить
                </button>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  )
}
