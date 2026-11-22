'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/rules', label: 'Правила', icon: '/icons/pencil.png' },
  { href: '/chat', label: 'Стена', icon: '/icons/wall.png' },
  { href: '/news', label: 'Новости', icon: '/icons/news.png' },
  { href: '/messages', label: 'Чат', icon: '/icons/chat.png' },
  { href: '/profile', label: 'Профиль', icon: '/icons/profile.png' },
]

export default function SidebarNav({ variant }: { variant: 'side' | 'top' }) {
  const pathname = usePathname()
  const [newsUnread, setNewsUnread] = useState(false)

  useEffect(() => {
    let active = true
    const check = async () => {
      try {
        const response = await fetch('/api/news')
        const payload = (await response.json()) as { news?: Array<{ created_at: string }> }
        const latest = payload.news?.[0]?.created_at
        if (!active || !latest) return
        const seen = localStorage.getItem('news:seen')
        setNewsUnread(!seen || latest > seen)
      } catch {
        // ignore
      }
    }
    void check()
    const timer = setInterval(check, 10000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [pathname])

  if (variant === 'top') {
    return (
      <nav className="flex items-center gap-2" aria-label="Разделы">
        {ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-transform duration-150 hover:-translate-y-0.5 ${
                active ? 'font-semibold text-black dark:text-white' : 'text-black dark:text-white'
              }`}
            >
              <Image src={item.icon} alt="" width={20} height={20} />
              {item.label}
            {item.href === '/news' && newsUnread && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#b9ff2e]" aria-label="Новая новость" />
            )}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="flex flex-col gap-2" aria-label="Разделы">
      {ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-full px-3 py-2.5 transition-transform duration-150 hover:-translate-y-0.5 ${
              active ? 'font-semibold text-black dark:text-white' : 'text-black dark:text-white'
            }`}
          >
            <Image src={item.icon} alt="" width={26} height={26} />
            <span className="flex items-center gap-2">
              {item.label}
              {item.href === '/news' && newsUnread && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#b9ff2e]" aria-label="Новая новость" />
              )}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
