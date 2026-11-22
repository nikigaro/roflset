import Image from 'next/image'
import MessagesTabs from './messages-tabs'

export default function MessagesPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-57px)] max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center gap-3">
        <Image src="/icons/chat.png" alt="" width={28} height={28} />
        <h1 className="text-3xl font-bold text-black dark:text-white">Чат</h1>
      </div>
      <MessagesTabs />
    </main>
  )
}
