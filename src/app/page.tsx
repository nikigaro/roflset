import Link from 'next/link'
import Logo from '@/components/logo'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto flex min-h-[calc(100vh-57px)] max-w-2xl flex-col items-center justify-center gap-8 px-6 text-center">
      <Logo />
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">РофлСеть</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {user ? 'С возвращением!' : 'Общая стена РофлСети. Регистрация только по имени пользователя и паролю.'}
        </p>
      </div>
      <div className="flex gap-4">
        {user ? (
          <>
            <Link
              href="/chat"
              className="rounded-full bg-black px-5 py-2.5 font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Стена
            </Link>
            <Link
              href="/profile"
              className="rounded-full border border-black px-5 py-2.5 font-medium text-black transition hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-neutral-900"
            >
              Профиль
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/register"
              className="rounded-full bg-black px-5 py-2.5 font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Регистрация
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-black px-5 py-2.5 font-medium text-black transition hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-neutral-900"
            >
              Вход
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
