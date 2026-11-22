import Link from 'next/link'
import RecoverForm from './recover-form'

export default function RecoverPage() {
  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col items-center gap-6">
        <RecoverForm />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          <Link href="/login" className="font-medium text-black underline underline-offset-4 dark:text-white">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    </main>
  )
}
