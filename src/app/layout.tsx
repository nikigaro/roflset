import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import Logo from '@/components/logo'
import SidebarNav from '@/components/sidebar-nav'
import ThemeToggle from '@/components/theme-toggle'
import VersionBadge from '@/components/version-badge'
import { subkultur } from '@/lib/font'
import { createClient } from '@/lib/supabase/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'РофлСеть',
  icons: { icon: '/logo-rofset.png' },
  description: 'Социальная сеть с безопасной регистрацией без email и телефона',
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const headerList = await headers()
  const csp = headerList.get('content-security-policy') ?? ''
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1] ?? ''

  const cookieStore = await cookies()
  const isDark = cookieStore.get('theme')?.value === 'dark'
  const htmlClass = `${subkultur.variable}${isDark ? ' dark' : ''}`

  // Стартовое окно — без шапки и боковой панели.
  if (headerList.get('x-gate') === '1') {
    return (
      <html lang="ru" className={htmlClass} suppressHydrationWarning>
        <head>{nonce ? <meta name="csp-nonce" content={nonce} /> : null}</head>
        <body className="min-h-screen bg-black text-white antialiased">{children}</body>
      </html>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <html lang="ru" className={htmlClass} suppressHydrationWarning>
      <head>
        {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
      </head>
      <body className="min-h-screen bg-white text-black antialiased dark:bg-[#0e0e10] dark:text-white">
        <header className="border-b border-neutral-300 bg-[#f0f0f0] dark:border-neutral-800 dark:bg-[#18181b]">
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-4 px-6 py-3 md:pl-[248px]">
            {!user && (
              <Link
                href="/register"
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                Регистрация
              </Link>
            )}
            <span className="text-xs text-neutral-500 transition-transform duration-150 hover:-translate-y-0.5 dark:text-neutral-400">
              by MURS
            </span>
          </div>
        </header>

        <div className="md:hidden">
          <div className="flex items-center gap-3 border-b border-neutral-200 bg-[#f0f0f0] px-4 py-2 dark:border-neutral-800 dark:bg-[#18181b]">
            <div className="flex items-center gap-2">
              <Logo />
              <VersionBadge />
            </div>
            <div className="flex-1 overflow-x-auto">
              <SidebarNav variant="top" />
            </div>
          </div>
        </div>

        <aside className="fixed left-0 top-0 z-50 hidden h-screen w-56 border-r border-neutral-300 bg-[#f0f0f0] p-4 dark:border-neutral-800 dark:bg-[#18181b] md:block">
          <div className="mb-6 flex items-center gap-2 px-2">
            <Logo />
            <VersionBadge />
          </div>
          <SidebarNav variant="side" />
        </aside>

        <ThemeToggle />

        <div className="min-h-[calc(100vh-57px)] md:pl-56">{children}</div>
      </body>
    </html>
  )
}
