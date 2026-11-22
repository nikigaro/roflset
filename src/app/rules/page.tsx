import { subkultur } from '@/lib/font'

export default function RulesPage() {
  return (
    <div className={subkultur.variable}>
      <main
        className="mx-auto flex min-h-[calc(100vh-57px)] max-w-3xl flex-col gap-6 px-6 py-10 text-black dark:text-white"
        style={{ fontFamily: 'var(--font-subkultur), sans-serif' }}
      >
        <h1 className="text-3xl font-bold">Правила</h1>
        <ol className="space-y-4">
          <li className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-800">
            <span className="font-semibold">1. Уважайте других.</span> Оскорбления, травля и дискриминация запрещены.
          </li>
          <li className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-800">
            <span className="font-semibold">2. Без спама.</span> Не публикуйте одно и то же многократно и не рекламируйте сторонние сервисы.
          </li>
          <li className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-800">
            <span className="font-semibold">3. Только свой контент.</span> Не выдавайте чужие работы за свои.
          </li>
          <li className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-800">
            <span className="font-semibold">4. Без опасного содержимого.</span> Угрозы, персональные данные и вредоносные ссылки удаляются.
          </li>
          <li className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-800">
            <span className="font-semibold">5. Жалобы.</span> Нарушения можно отметить кнопкой «Пожаловаться» под записью.
          </li>
        </ol>
      </main>
    </div>
  )
}
