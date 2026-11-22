'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { compressAvatar } from '@/lib/image'

type Tab = 'dm' | 'channels'
type Conversation = { username: string; lastText: string; lastAt: string }
type DmMessage = {
  id: number
  from_me: boolean
  partner: string
  text: string
  images: string[]
  created_at: string
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function MessagesTabs() {
  const [tab, setTab] = useState<Tab>('dm')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; username: string }>>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [unread, setUnread] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [text, setText] = useState('')
  const [images, setImages] = useState<Blob[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/dm')
      const payload = (await response.json()) as { conversations?: Conversation[] }
      if (response.ok) {
        const items = payload.conversations ?? []
        setConversations(items)
        const flags: Record<string, boolean> = {}
        items.forEach((item) => {
          const seen = localStorage.getItem(`dm:seen:${item.username}`)
          flags[item.username] = !seen || item.lastAt > seen
        })
        setUnread(flags)
      }
    } catch {
      // ignore
    }
  }, [])

  const loadThread = useCallback(async (username: string) => {
    try {
      const response = await fetch(`/api/dm?with=${encodeURIComponent(username)}`)
      const payload = (await response.json()) as { messages?: DmMessage[] }
      if (response.ok) {
        const items = payload.messages ?? []
        setMessages(items)
        const latest = items[items.length - 1]?.created_at
        if (latest) localStorage.setItem(`dm:seen:${username}`, latest)
        setUnread((previous) => ({ ...previous, [username]: false }))
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (tab !== 'dm') return
    void loadConversations()
    if (!selected) return
    const timer = setInterval(() => void loadThread(selected), 3000)
    return () => clearInterval(timer)
  }, [tab, selected, loadConversations, loadThread])

  useEffect(() => {
    const value = query.trim()
    if (!value) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(value)}`)
        const payload = (await response.json()) as { users?: Array<{ id: string; username: string }> }
        if (response.ok) setResults(payload.users ?? [])
      } catch {
        setResults([])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView()
  }, [messages.length])

  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const blob = await compressAvatar(file)
      setImages((previous) => (previous.length >= 3 ? previous : [...previous, blob]))
    } catch {
      setError('Не удалось обработать изображение.')
    }
  }

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || busy || (!text.trim() && images.length === 0)) return
    setBusy(true)
    setError(null)
    try {
      const urls: string[] = []
      if (images.length > 0) {
        const formData = new FormData()
        images.forEach((blob, index) => formData.append('images', new File([blob], `dm-${index}.webp`, { type: 'image/webp' })))
        const upload = await fetch('/api/chat/upload', { method: 'POST', body: formData })
        const uploaded = (await upload.json()) as { urls?: string[] }
        if (!upload.ok || !uploaded.urls) throw new Error('upload')
        urls.push(...uploaded.urls)
      }

      const response = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: selected, text, images: urls }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error === 'UNKNOWN_USER' ? 'Пользователь не найден.' : 'Не удалось отправить сообщение.')
        return
      }
      setText('')
      setImages([])
      await loadThread(selected)
      await loadConversations()
    } catch {
      setError('Сетевая ошибка.')
    } finally {
      setBusy(false)
    }
  }

  const buttonClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-transform duration-150 hover:-translate-y-0.5 ${
      active
        ? 'bg-black text-white dark:bg-white dark:text-black'
        : 'border border-neutral-400 text-black dark:border-neutral-600 dark:text-white'
    }`

  return (
    <>
      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найдите пользователя по @"
          className="w-full rounded-full border border-neutral-400 bg-white px-4 py-2.5 text-black outline-none focus:border-black dark:border-neutral-600 dark:bg-[#1f1f23] dark:text-white dark:focus:border-white"
        />
        {results.length > 0 && (
          <ul className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-[#1f1f23]">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(result.username)
                    setQuery('')
                    setResults([])
                    void loadThread(result.username)
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900"
                >
                  @{result.username}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-6 flex gap-2">
        <button type="button" onClick={() => setTab('dm')} className={buttonClass(tab === 'dm')}>
          ЛС
        </button>
        <button type="button" onClick={() => setTab('channels')} className={buttonClass(tab === 'channels')}>
          Каналы
        </button>
      </div>

      {tab === 'channels' ? (
        <div className="rounded-2xl border border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          Каналов пока нет.
        </div>
      ) : selected ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-sm text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
          >
            ← Все диалоги
          </button>
          <h2 className="text-lg font-semibold text-black dark:text-white">@{selected}</h2>

          <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-xl border border-neutral-300 p-4 dark:border-neutral-800">
            {messages.length === 0 && (
              <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">Сообщений пока нет.</p>
            )}
            {messages.map((message) => (
              <div key={message.id} className={message.from_me ? 'text-right' : 'text-left'}>
                <div className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.from_me ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-neutral-100 text-black dark:bg-[#26262c] dark:text-white'}`}>
                  {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
                  {message.images.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="Вложение" className="mt-2 max-h-52 rounded-lg object-cover" />
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-neutral-400">{formatTime(message.created_at)}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="space-y-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={1200}
              rows={2}
              placeholder="Сообщение…"
              className="w-full resize-none rounded-lg border border-neutral-400 bg-white px-3 py-2 text-black outline-none dark:border-neutral-600 dark:bg-[#1f1f23] dark:text-white"
            />
            {images.length > 0 && (
              <div className="flex gap-2">
                {images.map((blob, index) => (
                  <div key={index} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(blob)} alt="Вложение" className="h-14 w-14 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((previous) => previous.filter((_, i) => i !== index))}
                      className="absolute -right-1 -top-1 rounded-full bg-black px-1.5 text-xs text-white dark:bg-white dark:text-black"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFiles} className="text-xs text-neutral-500 dark:text-neutral-400" />
              <button
                type="submit"
                disabled={busy || (!text.trim() && images.length === 0)}
                className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                Отправить
              </button>
            </div>
            {error !== null && <p className="text-sm font-medium text-black dark:text-white">{error}</p>}
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-black dark:text-white">Диалоги</p>
          {conversations.length === 0 ? (
            <p className="rounded-2xl border border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              Диалогов пока нет. Найдите пользователя по @ выше.
            </p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.username}
                type="button"
                onClick={() => {
                  setSelected(conversation.username)
                  void loadThread(conversation.username)
                }}
                className="w-full rounded-xl border border-neutral-300 p-4 text-left transition-transform duration-150 hover:-translate-y-0.5 dark:border-neutral-800"
              >
                <p className="flex items-center gap-2 font-medium text-black dark:text-white">
                  @{conversation.username}
                  {unread[conversation.username] && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#b9ff2e]" aria-label="Новое сообщение" />
                  )}
                </p>
                <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{conversation.lastText}</p>
              </button>
            ))
          )}
        </div>
      )}
    </>
  )
}
