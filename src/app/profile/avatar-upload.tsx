'use client'

import { useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { compressAvatar } from '@/lib/image'

type AvatarUploadProps = {
  userId: string
  initialUrl: string
}

export default function AvatarUpload({ userId, initialUrl }: AvatarUploadProps) {
  const [url, setUrl] = useState(initialUrl)
  const [preview, setPreview] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const painting = useRef(false)

  const onSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const compressed = await compressAvatar(file)
      setPreview(URL.createObjectURL(compressed))
      setBroken(false)
    } catch {
      setError('Не удалось обработать фото.')
    }
  }

  const startDraw = () => {
    setDrawing(true)
    setError(null)
    requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth = 12
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    })
  }

  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    painting.current = true
    canvas.setPointerCapture(event.pointerId)
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo((event.clientX - rect.left) * (canvas.width / rect.width), (event.clientY - rect.top) * (canvas.height / rect.height))
  }

  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.strokeStyle = '#000000'
    ctx.lineTo((event.clientX - rect.left) * (canvas.width / rect.width), (event.clientY - rect.top) * (canvas.height / rect.height))
    ctx.stroke()
  }

  const pointerUp = () => {
    painting.current = false
  }

  const saveDrawing = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      setPreview(URL.createObjectURL(blob))
      setDrawing(false)
    }, 'image/webp', 0.8)
  }

  const save = async () => {
    if (!preview || busy) return
    setBusy(true)
    setError(null)
    try {
      const blob = await fetch(preview).then((response) => response.blob())
      const formData = new FormData()
      formData.append('avatar', new File([blob], 'avatar.webp', { type: 'image/webp' }))

      const response = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
      const payload = (await response.json()) as { avatarUrl?: string; message?: string }
      if (!response.ok || !payload.avatarUrl) {
        setError(payload.message ?? 'Не удалось сохранить аватар.')
        return
      }
      setUrl(`${payload.avatarUrl}?v=${Date.now()}`)
      setPreview(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const shown = preview ?? url

  return (
    <div className="mb-8">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e0e0e0] dark:bg-[#26262c]">
          {shown && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Аватар" className="h-full w-full object-cover" onError={() => setBroken(true)} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/profile.png" alt="" className="h-16 w-16 opacity-60" />
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onSelect}
            className="block max-w-[200px] text-xs text-neutral-600 file:mr-2 file:rounded-full file:border-0 file:bg-black/5 file:px-2 file:py-1 file:text-xs file:text-black hover:file:bg-black/10 dark:text-neutral-400 dark:file:bg-white/10 dark:file:text-white dark:hover:file:bg-white/20"
          />
          <button
            type="button"
            onClick={startDraw}
            className="mr-2 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-black transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            Нарисовать
          </button>
          {preview && (
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-black transition hover:bg-black/15 disabled:opacity-50 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
            >
              {busy ? 'Сохранение…' : 'Сохранить аватар'}
            </button>
          )}
          {error !== null && <p className="text-sm font-medium text-black dark:text-white">{error}</p>}
        </div>
      </div>

      {drawing && (
        <div className="mt-4 space-y-3 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
          <canvas
            ref={canvasRef}
            width={256}
            height={256}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerLeave={pointerUp}
            className="mx-auto block h-48 w-48 cursor-crosshair touch-none rounded-full border border-neutral-400 bg-white dark:border-neutral-600"
          />
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                const ctx = canvasRef.current?.getContext('2d')
                if (ctx && canvasRef.current) {
                  ctx.fillStyle = '#ffffff'
                  ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                }
              }}
              className="rounded-full bg-black/5 px-2.5 py-1 text-xs text-black transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            >
              Очистить
            </button>
            <button
              type="button"
              onClick={saveDrawing}
              className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
