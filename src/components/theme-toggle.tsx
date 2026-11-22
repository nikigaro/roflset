'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

/** Маленькая кнопка темы в левом нижнем углу. */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    document.cookie = `theme=${next ? 'dark' : 'light'}; path=/; max-age=31536000; SameSite=Lax`
    setDark(next)
    window.dispatchEvent(new Event('themechange'))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={dark ? 'Светлая тема' : 'Тёмная тема'}
      className="fixed bottom-4 left-4 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white/80 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-[#1f1f23]/80 dark:hover:bg-neutral-900"
    >
      <Image src="/theme-icon.png" alt="" width={18} height={18} className="block" />
    </button>
  )
}
