/** Сжимает фото аватара в браузере: WebP, макс. 256×256, качество 0.8. */
const MAX_SIZE = 256
const QUALITY = 0.8

export async function compressAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas недоступен')

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/webp', QUALITY)
  })

  if (!blob) throw new Error('Не удалось сжать изображение')
  return blob
}
