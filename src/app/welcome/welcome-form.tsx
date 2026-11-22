'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function WelcomeForm() {
  const [remember, setRemember] = useState(false)

  useEffect(() => {
    setRemember(document.cookie.split('; ').some((item) => item === 'remember=1'))
  }, [])

  const toggle = (checked: boolean) => {
    setRemember(checked)
    document.cookie = checked
      ? 'remember=1; path=/; max-age=31536000; SameSite=Lax'
      : 'remember=0; path=/; max-age=0; SameSite=Lax'
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-black px-6 text-white">
      <div className="flex items-center gap-3">
        <Image src="/logo-rofset.png" alt="РофлСеть" width={80} height={80} className="invert" />
        <span className="rounded-full border border-neutral-600 px-3 py-1 text-sm text-neutral-300">v1</span>
      </div>

      <h1 className="text-3xl font-bold">Вход</h1>

      <div className="flex flex-col items-center gap-4">
        <Link
          href="/login"
          className="rounded-full bg-white px-8 py-2.5 font-medium text-black transition hover:bg-neutral-200"
        >
          Войти
        </Link>
        <Link
          href="/register"
          className="rounded-full border border-white px-8 py-2.5 font-medium text-white transition hover:bg-white/10"
        >
          Регистрация
        </Link>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => toggle(event.target.checked)}
          className="h-4 w-4 accent-white"
        />
        Запомнить меня
      </label>
    </main>
  )
}
