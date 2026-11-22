'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressAvatar } from '@/lib/image'

type ChatMessage = {
  id: number
  user_id: string
  content: string
  created_at: string
  username: string
}

type ReportReason = 'spam' | 'abuse' | 'other'

const REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Спам',
  abuse: 'Оскорбление',
  other: 'Другое',
}

type PostContent = { t: string; i: string[] }

const POSTS_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/posts/`

function parsePost(content: string): PostContent | null {
  try {
    const parsed = JSON.parse(content) as Partial<PostContent>
    if (
      typeof parsed.t !== 'string' ||
      !Array.isArray(parsed.i) ||
      !parsed.i.every((url) => typeof url === 'string' && url.startsWith(POSTS_PREFIX))
    ) {
      return null
    }
    return { t: parsed.t, i: parsed.i }
  } catch {
    return null
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  // По умолчанию МСК (Россия); Intl сам учитывает правила перехода часового пояса.
  const timeZone = 'Europe/Moscow'
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function MessageItem({
  message,
  onReport,
  isAdmin,
  onDelete,
}: {
  message: ChatMessage
  onReport: (messageId: number, reason: ReportReason) => void
  isAdmin: boolean
  onDelete: (messageId: number) => void
}) {
  const [reason, setReason] = useState<ReportReason>('spam')
  const post = parsePost(message.content)

  return (
    <li className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-800 dark:bg-[#1f1f23]">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-semibold text-black dark:text-white">{message.username}</span>
        <time suppressHydrationWarning className="text-xs text-neutral-500 dark:text-neutral-400" dateTime={message.created_at}>
          {formatTime(message.created_at)}
        </time>
      </div>
      {/* XSS: только открытый текст, рендер как обычный текст React. */}
      <p className="break-words text-sm text-black dark:text-white">{post ? post.t : message.content}</p>
      {post && post.i.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {post.i.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="Вложение" className="max-h-60 w-full rounded-lg object-cover" />
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <select
          aria-label="Причина жалобы"
          value={reason}
          onChange={(event) => setReason(event.target.value as ReportReason)}
          className="rounded border border-neutral-400 bg-white px-2 py-1 text-xs text-black dark:border-neutral-600 dark:bg-[#1f1f23] dark:text-white"
        >
          {(Object.keys(REASON_LABELS) as ReportReason[]).map((key) => (
            <option key={key} value={key}>
              {REASON_LABELS[key]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onReport(message.id, reason)}
          className="rounded-full border border-black px-3 py-1 text-xs text-black transition hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-neutral-900"
        >
          Пожаловаться
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            className="ml-auto rounded-full border border-red-500 px-3 py-1 text-xs text-red-500 transition hover:bg-red-500/10"
          >
            Удалить
          </button>
        )}
      </div>
    </li>
  )
}

export default function ChatClient({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [postText, setPostText] = useState('')
  const [postImages, setPostImages] = useState<Blob[]>([])
  const [drawingPost, setDrawingPost] = useState(false)
  const [posting, setPosting] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const postCanvasRef = useRef<HTMLCanvasElement>(null)
  const paintingPost = useRef(false)

  const fetchUsername = useCallback(
    async (userId: string): Promise<string> => {
      const { data } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle()
      return data?.username ?? 'unknown'
    },
    [supabase],
  )

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const response = await fetch('/api/chat/messages')
        const payload = (await response.json()) as {
          messages?: ChatMessage[]
          nextCursor?: string | null
        }
        if (!active || !response.ok) return
        setMessages(payload.messages ?? [])
        setNextCursor(payload.nextCursor ?? null)
      } catch {
        if (active) setError('Не удалось загрузить историю.')
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (channelRef.current) return

    const channel = supabase
      .channel('general')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const row = payload.new as {
          id: number
          user_id: string
          content: string
          created_at: string
          hidden: boolean
        }
        if (row.hidden || row.content.startsWith('{"k":"news"')) return
        const username = await fetchUsername(row.user_id)
        setMessages((previous) =>
          previous.some((message) => message.id === row.id)
            ? previous
            : [{ id: row.id, user_id: row.user_id, content: row.content, created_at: row.created_at, username }, ...previous],
        )
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as { id: number; hidden: boolean }
        if (row.hidden) setMessages((previous) => previous.filter((message) => message.id !== row.id))
      })

    channelRef.current = channel
    void channel.subscribe()

    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [supabase, fetchUsername])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const response = await fetch(`/api/chat/messages?cursor=${encodeURIComponent(nextCursor)}`)
      const payload = (await response.json()) as { messages?: ChatMessage[]; nextCursor?: string | null }
      if (!response.ok) return
      const older = payload.messages ?? []
      setMessages((previous) => {
        const ids = new Set(previous.map((message) => message.id))
        return [...previous, ...older.filter((message) => !ids.has(message.id))]
      })
      setNextCursor(payload.nextCursor ?? null)
    } finally {
      setLoadingMore(false)
    }
  }

  const onPostFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const blob = await compressAvatar(file)
      setPostImages((previous) => (previous.length >= 3 ? previous : [...previous, blob]))
    } catch {
      setError('Не удалось обработать изображение.')
    }
  }

  const postPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = postCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    paintingPost.current = true
    canvas.setPointerCapture(event.pointerId)
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo((event.clientX - rect.left) * (canvas.width / rect.width), (event.clientY - rect.top) * (canvas.height / rect.height))
  }

  const postPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!paintingPost.current) return
    const canvas = postCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.strokeStyle = '#000000'
    ctx.lineTo((event.clientX - rect.left) * (canvas.width / rect.width), (event.clientY - rect.top) * (canvas.height / rect.height))
    ctx.stroke()
  }

  const postPointerUp = () => {
    paintingPost.current = false
  }

  const attachDrawing = () => {
    const canvas = postCanvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (blob) setPostImages((previous) => (previous.length >= 3 ? previous : [...previous, blob]))
    }, 'image/webp', 0.8)
    setDrawingPost(false)
  }

  const publishPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (posting || (!postText.trim() && postImages.length === 0)) return
    setPosting(true)
    setError(null)
    try {
      const imageUrls: string[] = []
      if (postImages.length > 0) {
        const formData = new FormData()
        postImages.forEach((blob, index) => formData.append('images', new File([blob], `draw-${index}.webp`, { type: 'image/webp' })))
        const upload = await fetch('/api/chat/upload', { method: 'POST', body: formData })
        const uploaded = (await upload.json()) as { urls?: string[]; message?: string }
        if (!upload.ok || !uploaded.urls) {
          setError(uploaded.message ?? 'Не удалось загрузить изображения.')
          return
        }
        imageUrls.push(...uploaded.urls)
      }

      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify({ t: postText.slice(0, 1600), i: imageUrls }) }),
      })
      const payload = (await response.json()) as { message?: ChatMessage; messageText?: string }
      if (!response.ok || !payload.message) {
        setError(typeof payload.messageText === 'string' ? payload.messageText : 'Не удалось опубликовать пост.')
        return
      }
      const sent = payload.message
      setMessages((previous) => (previous.some((m) => m.id === sent.id) ? previous : [sent, ...previous]))
      setPostText('')
      setPostImages([])
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
    } finally {
      setPosting(false)
    }
  }

  const report = async (messageId: number, reason: ReportReason) => {
    setNotice(null)
    setError(null)
    try {
      const response = await fetch('/api/chat/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId, reason }),
      })
      const payload = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) {
        setError(payload.message ?? 'Не удалось отправить жалобу.')
        return
      }
      setNotice('Жалоба отправлена. Спасибо.')
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
    }
  }

  const deletePost = async (messageId: number) => {
    setError(null)
    try {
      const response = await fetch('/api/moderation/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      if (!response.ok) {
        setError('Не удалось удалить запись.')
        return
      }
      setMessages((previous) => previous.filter((message) => message.id !== messageId))
    } catch {
      setError('Сетевая ошибка.')
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-57px)] max-w-3xl flex-col px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-black dark:text-white">Стена</h1>
      </div>

      <form onSubmit={publishPost} className="mb-6 space-y-3 rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-800 dark:bg-[#1f1f23]">
        <label className="block text-sm font-medium text-black dark:text-white" htmlFor="postText">
          Пост на стену
        </label>
        <textarea
          id="postText"
          value={postText}
          onChange={(event) => setPostText(event.target.value)}
          maxLength={1600}
          rows={3}
          placeholder="Что написать на стене?"
          className="w-full resize-none rounded-lg border border-neutral-400 bg-white px-3 py-2 text-black outline-none focus:border-black dark:border-neutral-600 dark:bg-[#1f1f23] dark:text-white dark:focus:border-white"
        />
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPostFile}
            className="text-xs text-neutral-600 dark:text-neutral-400"
          />
          <button
            type="button"
            onClick={() => setDrawingPost(true)}
            className="rounded-full border border-black px-3 py-1.5 text-sm text-black dark:border-white dark:text-white"
          >
            Нарисовать
          </button>
          <button
            type="submit"
            disabled={posting || (!postText.trim() && postImages.length === 0)}
            className="rounded-full bg-black px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {posting ? 'Публикация…' : 'Опубликовать'}
          </button>
        </div>

        {postImages.length > 0 && (
          <div className="flex gap-2">
            {postImages.map((blob, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={index} src={URL.createObjectURL(blob)} alt="Вложение" className="h-16 w-16 rounded object-cover" />
            ))}
          </div>
        )}

        {drawingPost && (
          <div className="space-y-3 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
            <canvas
              ref={postCanvasRef}
              width={256}
              height={256}
              onPointerDown={postPointerDown}
              onPointerMove={postPointerMove}
              onPointerUp={postPointerUp}
              onPointerLeave={postPointerUp}
              className="mx-auto block h-40 w-40 cursor-crosshair touch-none rounded-lg border border-neutral-400 bg-white"
            />
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const ctx = postCanvasRef.current?.getContext('2d')
                  if (ctx && postCanvasRef.current) {
                    ctx.fillStyle = '#ffffff'
                    ctx.fillRect(0, 0, postCanvasRef.current.width, postCanvasRef.current.height)
                  }
                }}
                className="rounded-full border border-black px-3 py-1.5 text-sm text-black dark:border-white dark:text-white"
              >
                Очистить
              </button>
              <button
                type="button"
                onClick={attachDrawing}
                className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
              >
                Прикрепить
              </button>
            </div>
          </div>
        )}
      </form>

      {error !== null && (
        <p className="mb-4 border-l-2 border-black bg-neutral-100 px-3 py-2 text-sm font-medium text-black dark:border-white dark:bg-neutral-900 dark:text-white">
          {error}
        </p>
      )}
      {notice !== null && <p className="mb-4 text-sm text-black dark:text-white">{notice}</p>}

      <ul className="space-y-3">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} onReport={report} isAdmin={isAdmin} onDelete={deletePost} />
        ))}
      </ul>

      {messages.length === 0 && (
        <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">У вас еще нет сообщений</p>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-6 w-full rounded-full border border-black px-4 py-2 font-medium text-black transition hover:bg-neutral-100 disabled:opacity-50 dark:border-white dark:text-white dark:hover:bg-neutral-900"
        >
          {loadingMore ? 'Загрузка…' : 'Загрузить ещё'}
        </button>
      )}
    </main>
  )
}
