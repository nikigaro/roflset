import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 *SERVER ONLY.* Коды создаются на сервере через crypto.randomBytes.
 * В БД попадает только `соль + SHA256(соль || код)`; открытый вид существует
 * только в ответе запроса регистрации и в браузере пользователя.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const GROUP_LENGTH = 4
const GROUPS = 3
export const RECOVERY_CODE_COUNT = 10
const SALT_BYTES = 16
const HASH_HEX_LENGTH = 64
const STORED_HASH_LENGTH = SALT_BYTES * 2 + HASH_HEX_LENGTH

export type IssuedRecoveryCodes = {
  codes: string[]
  hashes: string[]
}

export function generateRecoveryCodes(): string[] {
  const codes: string[] = []

  for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
    const bytes = randomBytes(GROUP_LENGTH * GROUPS)
    const groups: string[] = []

    for (let g = 0; g < GROUPS; g += 1) {
      let group = ''
      for (let j = 0; j < GROUP_LENGTH; j += 1) {
        const byte = bytes[g * GROUP_LENGTH + j] ?? 0
        group += ALPHABET[byte % ALPHABET.length] ?? ''
      }
      groups.push(group)
    }

    codes.push(groups.join('-'))
  }

  return codes
}

/** Одна случайная соль на пользователя, вшитая в префикс каждой записи. */
export function hashRecoveryCodes(codes: readonly string[], salt: Buffer = randomBytes(SALT_BYTES)): IssuedRecoveryCodes {
  const saltHex = salt.toString('hex')
  const hashes = codes.map(
    (code) => `${saltHex}${createHash('sha256').update(salt).update(code, 'utf8').digest('hex')}`,
  )
  return { codes: [...codes], hashes }
}

/** Сравнение по постоянному времени; соль берётся из самой сохранённой записи. */
export function verifyRecoveryCode(code: string, storedHash: string): boolean {
  if (!/^[a-f0-9]{96}$/.test(storedHash) || storedHash.length !== STORED_HASH_LENGTH) return false

  const salt = Buffer.from(storedHash.slice(0, SALT_BYTES * 2), 'hex')
  const expected = Buffer.from(storedHash.slice(SALT_BYTES * 2), 'hex')
  const actual = createHash('sha256').update(salt).update(code, 'utf8').digest()

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
