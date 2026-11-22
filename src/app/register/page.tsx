import Link from 'next/link'
import RegisterForm from './register-form'

export default function RegisterPage() {
  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col items-center gap-6">
        <RegisterForm />
        <p className="text-sm text-neutral-600">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="font-medium text-black underline underline-offset-4">
            Войти
          </Link>
        </p>
      </div>
    </main>
  )
}
