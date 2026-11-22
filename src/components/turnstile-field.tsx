'use client'

import { useEffect, useRef, useState } from 'react'

type TurnstileFieldProps = {
  onTokenChange: (token: string | null) => void
  resetSignal: number
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** Обёртка над официальным виджетом Turnstile (без сторонних обёрток). */
export default function TurnstileField({ onTokenChange, resetSignal }: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const sync = () => setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    sync()
    window.addEventListener('themechange', sync)
    return () => window.removeEventListener('themechange', sync)
  }, [])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    const renderWidget = () => {
      const api = window.turnstile
      if (!api || !containerRef.current || widgetIdRef.current) return
      widgetIdRef.current = api.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onTokenChange(token),
        'expired-callback': () => onTokenChange(null),
        'error-callback': () => onTokenChange(null),
      })
    }

    let script = document.querySelector<HTMLScriptElement>('script[data-turnstile-widget]')
    if (!script) {
      script = document.createElement('script')
      script.src = SCRIPT_URL
      script.async = true
      script.defer = true
      script.dataset.turnstileWidget = 'true'
      document.head.appendChild(script)
    }

    script.addEventListener('load', renderWidget)
    if (window.turnstile) renderWidget()

    return () => {
      script?.removeEventListener('load', renderWidget)
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey, onTokenChange, theme])

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
      onTokenChange(null)
    }
  }, [resetSignal, onTokenChange])

  if (!siteKey) {
    return (
      <p className="border-l-2 border-black bg-neutral-100 px-3 py-2 text-sm font-medium text-black dark:border-white dark:bg-neutral-900 dark:text-white">
        Не задан NEXT_PUBLIC_TURNSTILE_SITE_KEY
      </p>
    )
  }

  return (
    <div className="flex min-h-[65px] items-center">
      <div ref={containerRef} />
    </div>
  )
}
