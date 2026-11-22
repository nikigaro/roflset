import { APP_VERSION } from '@/lib/version'

/** Маленький счётчик версий рядом с логотипом. */
export default function VersionBadge() {
  return (
    <span
      title={`Версия ${APP_VERSION}`}
      className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-500 transition-transform duration-150 hover:-translate-y-0.5 dark:border-neutral-700 dark:text-neutral-400"
    >
      v{APP_VERSION}
    </span>
  )
}
