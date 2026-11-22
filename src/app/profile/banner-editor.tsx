'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

type BannerEditorProps = { initialUrl: string }
type Tool = 'brush' | 'fill' | 'eraser'

const WIDTH = 1200
const HEIGHT = 300

function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const image = ctx.getImageData(0, 0, WIDTH, HEIGHT)
  const data = image.data
  const start = (y * WIDTH + x) * 4
  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]].map((value) => value ?? 0)
  const hex = color.replace('#', '')
  const replacement = [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    255,
  ]
  if (target.every((value, index) => value === replacement[index])) return

  const stack: number[] = [start]
  const matches = (index: number) =>
    data[index] === target[0] && data[index + 1] === target[1] && data[index + 2] === target[2] && data[index + 3] === target[3]

  while (stack.length > 0) {
    const index = stack.pop()!
    if (!matches(index)) continue
    data[index] = replacement[0]!
    data[index + 1] = replacement[1]!
    data[index + 2] = replacement[2]!
    data[index + 3] = replacement[3]!

    const pixel = index / 4
    const px = pixel % WIDTH
    const py = Math.floor(pixel / WIDTH)
    if (px > 0) stack.push(index - 4)
    if (px < WIDTH - 1) stack.push(index + 4)
    if (py > 0) stack.push(index - WIDTH * 4)
    if (py < HEIGHT - 1) stack.push(index + WIDTH * 4)
  }

  ctx.putImageData(image, 0, 0)
}

export default function BannerEditor({ initialUrl }: BannerEditorProps) {
  const [bannerUrl, setBannerUrl] = useState(initialUrl)
  const [open, setOpen] = useState(false)
  const [tool, setTool] = useState<Tool>('brush')
  const [brushSize, setBrushSize] = useState(12)
  const [color, setColor] = useState('#000000')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const painting = useRef(false)

  const start = () => {
    setOpen(true)
    setError(null)
    requestAnimationFrame(() => {
      const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize
    })
  }

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.floor((event.clientX - rect.left) * (canvas.width / rect.width)),
      y: Math.floor((event.clientY - rect.top) * (canvas.height / rect.height)),
    }
  }

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx) return
    canvas.setPointerCapture(event.pointerId)
    const { x, y } = point(event)

    if (tool === 'fill') {
      floodFill(ctx, Math.min(WIDTH - 1, Math.max(0, x)), Math.min(HEIGHT - 1, Math.max(0, y)), color)
      return
    }

    painting.current = true
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.lineWidth = brushSize
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current) return
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const { x, y } = point(event)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const up = () => {
    painting.current = false
  }

  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  const save = async () => {
    const canvas = canvasRef.current
    if (!canvas || busy) return
    setBusy(true)
    setError(null)
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
      if (!blob) throw new Error('blob')

      const formData = new FormData()
      formData.append('images', new File([blob], 'banner.webp', { type: 'image/webp' }))
      const upload = await fetch('/api/chat/upload', { method: 'POST', body: formData })
      const uploaded = (await upload.json()) as { urls?: string[] }
      if (!upload.ok || !uploaded.urls?.[0]) throw new Error('upload')

      const supabase = createClient()
      await supabase.auth.updateUser({ data: { bannerUrl: uploaded.urls[0] } })
      setBannerUrl(uploaded.urls[0])
      setOpen(false)
      setNotice('Баннер сохранён.')
    } catch {
      setError('Не удалось сохранить баннер.')
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    if (!bannerUrl || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify({ t: '', i: [bannerUrl] }) }),
      })
      if (!response.ok) throw new Error('post')
      setNotice('Баннер опубликован на стене.')
    } catch {
      setError('Не удалось опубликовать баннер.')
    } finally {
      setBusy(false)
    }
  }

  const toolButton = (value: Tool, label: string) => (
    <button
      type="button"
      onClick={() => setTool(value)}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        tool === value
          ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
          : 'border-neutral-300 text-black hover:bg-neutral-100 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-900'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mb-8">
      <div
        className="flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-[#e5e5e5] dark:bg-[#26262c]"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!bannerUrl && <span className="text-sm text-neutral-500 dark:text-neutral-400">Баннер не нарисован</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-black transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
        >
          Нарисовать баннер
        </button>
        {bannerUrl && (
          <button
            type="button"
            onClick={publish}
            disabled={busy}
            className="rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-black transition hover:bg-black/15 disabled:opacity-50 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
          >
            На стену
          </button>
        )}
      </div>
      {notice !== null && <p className="mt-2 text-sm text-black dark:text-white">{notice}</p>}
      {error !== null && <p className="mt-2 text-sm font-medium text-black dark:text-white">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-neutral-300 bg-white p-5 dark:border-neutral-700 dark:bg-[#18181b]">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="font-semibold text-black dark:text-white">Рисование баннера</span>
              {toolButton('brush', 'Кисть')}
              {toolButton('fill', 'Заливка')}
              {toolButton('eraser', 'Ластик')}
              <label className="flex items-center gap-2 text-sm text-black dark:text-white">
                Размер
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={brushSize}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                  className="w-28"
                />
                {brushSize}
              </label>
              <label className="flex items-center gap-2 text-sm text-black dark:text-white">
                Цвет
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-neutral-400 bg-transparent"
                />
              </label>
            </div>

            <canvas
              ref={canvasRef}
              width={WIDTH}
              height={HEIGHT}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={up}
              className="block w-full cursor-crosshair touch-none rounded-lg border border-neutral-400 bg-white"
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={clear}
                className="rounded-full border border-black px-4 py-2 text-sm font-medium text-black dark:border-white dark:text-white"
              >
                Очистить
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-neutral-400 px-4 py-2 text-sm text-black dark:border-neutral-600 dark:text-white"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {busy ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
