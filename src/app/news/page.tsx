import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import NewsClient from './news-client'

export default async function NewsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAdmin = user?.app_metadata?.role === 'admin'

  return (
    <main className="mx-auto flex min-h-[calc(100vh-57px)] max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center gap-3">
        <Image src="/icons/news.png" alt="" width={28} height={28} />
        <h1 className="text-3xl font-bold text-black dark:text-white">Новости</h1>
      </div>
      <NewsClient isAdmin={isAdmin} />
    </main>
  )
}
