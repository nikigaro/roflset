/**
 * Единственное место, где создаётся синтетический email.
 * Домен .test зарезервирован RFC 2606: он гарантированно не существует,
 * письма никуда не уходят, и его нельзя занять. (.invalid Supabase Auth
 * отклоняет как невалидный адрес.)
 */
const SYNTHETIC_EMAIL_DOMAIN = 'users.prostoset.test'

export function syntheticEmail(username: string): string {
  return `${username}@${SYNTHETIC_EMAIL_DOMAIN}`
}

/** Искусственная задержка 500–800 мс на неудачных операциях (анти-timing). */
export async function antiTimingDelay(): Promise<void> {
  const milliseconds = 500 + Math.floor(Math.random() * 301)
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}
