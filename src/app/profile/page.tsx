import Image from 'next/image'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AvatarUpload from './avatar-upload'
import BioForm from './bio-form'
import BannerEditor from './banner-editor'
import ChangePasswordForm from './change-password-form'
import LogoutButton from './logout-button'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // RLS: пользователь видит только свою строку профиля.
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  const { data: sessionData } = await supabase.auth.getSession()
  const userAgent = (await headers()).get('user-agent') ?? 'Неизвестное устройство'
  const expiresAt = sessionData.session?.expires_at
    ? new Date(sessionData.session.expires_at * 1000).toISOString().slice(0, 16).replace('T', ' ')
    : '—'

  const avatarUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/avatar.webp`
  const isAdmin = user.app_metadata?.role === 'admin'

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-[#f0f0f0] p-8 text-black dark:bg-[#1f1f23] dark:text-white">
        <h1 className="mb-6 text-2xl font-semibold text-black dark:text-white">Профиль</h1>

        <BannerEditor
          initialUrl={typeof user.user_metadata?.bannerUrl === 'string' ? user.user_metadata.bannerUrl : ''}
        />

        <AvatarUpload userId={user.id} initialUrl={avatarUrl} />

        <dl className="mb-8 space-y-1">
          <dt className="text-sm text-neutral-500 dark:text-neutral-400">Имя пользователя</dt>
          <dd className="flex items-center gap-2 font-mono text-lg text-black dark:text-white">
            {profile?.username ?? '—'}
            {isAdmin && (
              <Image
                src="/icons/creator.png"
                alt="Создатель"
                title="Создатель"
                width={18}
                height={18}
                className="shrink-0"
              />
            )}
          </dd>
        </dl>

        <section className="mb-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="mb-4 text-lg font-semibold text-black dark:text-white">Обо мне</h2>
          <BioForm initialBio={typeof user.user_metadata?.bio === 'string' ? user.user_metadata.bio : ''} />
        </section>

        <section className="mb-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <div className="mb-4 flex items-center gap-3">
            <Image src="/icons/connection.png" alt="" width={24} height={24} />
            <h2 className="text-lg font-semibold text-black dark:text-white">Подключение</h2>
          </div>
          <div className="rounded-lg border border-neutral-300 p-4 text-sm dark:border-neutral-700">
            <p className="font-medium text-black dark:text-white">Это устройство</p>
            <p className="break-all text-neutral-500 dark:text-neutral-400">{userAgent.slice(0, 120)}</p>
            <p className="mt-2 text-neutral-500 dark:text-neutral-400">Сессия активна до: {expiresAt} UTC</p>
          </div>
        </section>

        <section className="mb-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="mb-4 text-lg font-semibold text-black dark:text-white">Сменить пароль</h2>
          <ChangePasswordForm />
        </section>

        <LogoutButton />
      </div>
    </main>
  )
}
