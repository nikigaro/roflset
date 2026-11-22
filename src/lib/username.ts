/** Зарезервированные ники: регистрация запрещена (HTTP 400). */
export const RESERVED_USERNAMES = [
  'admin',
  'root',
  'support',
  'moderator',
  'system',
  'null',
  'undefined',
  'api',
  'help',
  'official',
  'prostoset',
  'rofset',
] as const

export type ReservedUsername = (typeof RESERVED_USERNAMES)[number]

export function isReservedUsername(value: string): value is ReservedUsername {
  return (RESERVED_USERNAMES as readonly string[]).includes(value)
}
