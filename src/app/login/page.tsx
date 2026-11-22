import Link from 'next/link'
import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col items-center gap-6">
        <LoginForm />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Нет аккаунта?{' '}
          <Link href="/register" className="font-medium text-black underline underline-offset-4 dark:text-white">
            Зарегистрироваться
          </Link>
          <span className="mx-2">·</span>
          <Link href="/recover" className="font-medium text-black underline underline-offset-4 dark:text-white">
            Забыли пароль?
          </Link>
        </p>
      </div>
    </main>
  )
}
