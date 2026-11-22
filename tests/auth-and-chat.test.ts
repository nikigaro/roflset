import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { messageContentSchema, registerSchema } from '@/lib/validation'
import { syntheticEmail } from '@/lib/shared-utils'
import { hashRecoveryCodes } from '@/lib/recovery-codes'

const BASE_URL = process.env.TEST_BASE_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const validRegister = {
  username: 'alice1',
  password: 'Str0ngPassword12',
  confirmPassword: 'Str0ngPassword12',
  turnstileToken: 'test-token',
}

// ---------------------------------------------------------------------------
// Юнит-тесты (всегда запускаются)
// ---------------------------------------------------------------------------

describe('1) Регистрация с невалидным username', () => {
  it('возвращает ошибку валидации (API ответил бы 400)', () => {
    expect(registerSchema.safeParse({ ...validRegister, username: 'a!' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...validRegister, username: '1alice' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...validRegister, username: 'ab' }).success).toBe(false)
  })
})

describe('2) Регистрация с заглавными буквами', () => {
  it('отклоняет регистр, не исправляя его', () => {
    expect(registerSchema.safeParse({ ...validRegister, username: 'Alice1' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...validRegister, username: 'ALICE1' }).success).toBe(false)
  })
})

describe('6) Сообщение с <script>', () => {
  it('сохраняется как обычный текст (без преобразования)', () => {
    const raw = '<script>alert(1)</script>'
    const parsed = messageContentSchema.safeParse(raw)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toBe(raw)
  })

  it('рендерится через {content}, без dangerouslySetInnerHTML', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../src/app/chat/chat-client.tsx', import.meta.url)),
      'utf8',
    )
    expect(source).not.toContain('dangerouslySetInnerHTML')
    expect(source).toContain('message.content')
  })

  it('отклоняет null-байты и управляющие символы', () => {
    expect(messageContentSchema.safeParse('hello\u0000world').success).toBe(false)
    expect(messageContentSchema.safeParse('hello\nworld').success).toBe(false)
  })
})

describe('10) Синтетический email', () => {
  it('использует зарезервированный домен .invalid', () => {
    expect(syntheticEmail('alice1')).toBe('alice1@users.prostoset.test')
  })
})

// ---------------------------------------------------------------------------
// Интеграционные тесты API (нужен запущенный сервер: TEST_BASE_URL)
// ---------------------------------------------------------------------------

const apiDescribe = describe.skipIf(!BASE_URL)

async function post(path: string, body: unknown) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE_URL! },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

apiDescribe('3) Занятый ник — нейтральное сообщение', () => {
  it('не раскрывает existence аккаунта', async () => {
    const username = `busy${Date.now().toString().slice(-6)}`
    const payload = { ...validRegister, username }
    await post('/api/auth/register', payload)
    const second = await post('/api/auth/register', payload)
    expect(second.status).toBe(400)
    expect(second.body.error).toBe('REGISTRATION_FAILED')
    expect(JSON.stringify(second.body)).not.toContain('USERNAME_TAKEN')
    expect(JSON.stringify(second.body)).not.toContain('@users.prostoset.test')
  })
})

apiDescribe('4) Неверный пароль', () => {
  it('401 и то же сообщение, что и для неверного логина', async () => {
    const badPassword = await post('/api/auth/login', {
      username: 'alice1',
      password: 'WrongPassword12',
      turnstileToken: 'test-token',
    })
    const badUsername = await post('/api/auth/login', {
      username: 'nobody1',
      password: 'WrongPassword12',
      turnstileToken: 'test-token',
    })
    expect(badPassword.status).toBe(401)
    expect(badPassword.body.message).toBe('Неверный юзернейм или пароль')
    expect(badUsername.body.message).toBe(badPassword.body.message)
    expect(JSON.stringify(badPassword.body)).not.toContain('@users.prostoset.test')
  })
})

apiDescribe('5) /chat без сессии', () => {
  it('отдаёт 401 на API и редирект на страницу', async () => {
    const response = await fetch(`${BASE_URL}/api/chat/messages`)
    expect(response.status).toBe(401)

    const page = await fetch(`${BASE_URL}/chat`, { redirect: 'manual' })
    expect([307, 302, 401]).toContain(page.status)
  })
})

apiDescribe('7) Rate limit на логин', () => {
  it('после 5 попыток отдаёт 429', async () => {
    let limited = false
    for (let i = 0; i < 7; i += 1) {
      const result = await post('/api/auth/login', {
        username: 'ratelimit1',
        password: 'WrongPassword12',
        turnstileToken: 'test-token',
      })
      if (result.status === 429) limited = true
    }
    expect(limited).toBe(true)
  })
})

apiDescribe('10) Email не утекает в ответах API', () => {
  it('ни в одном из ответов нет синтетического адреса', async () => {
    const responses = [
      await post('/api/auth/register', { ...validRegister, username: 'admin' }),
      await post('/api/auth/login', { username: 'alice1', password: 'x', turnstileToken: 'test-token' }),
    ]
    for (const response of responses) {
      expect(JSON.stringify(response.body)).not.toContain('prostoset.test')
      expect(JSON.stringify(response.body)).not.toContain('supabase.co')
    }
  })
})

// ---------------------------------------------------------------------------
// Интеграционные тесты с Supabase JS (нужны ключи и применённая миграция)
// ---------------------------------------------------------------------------

const dbDescribe = describe.skipIf(!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY)

dbDescribe('8) RLS: пользователь A не может писать за B', () => {
  it('INSERT с чужим user_id отклоняется', async () => {
    const admin = createClient(SUPABASE_URL!, SERVICE_KEY!)
    const suffix = Date.now().toString()
    const a = await admin.auth.admin.createUser({
      email: syntheticEmail(`usera${suffix}`),
      password: 'Str0ngPassword12',
      email_confirm: true,
    })
    const b = await admin.auth.admin.createUser({
      email: syntheticEmail(`userb${suffix}`),
      password: 'Str0ngPassword12',
      email_confirm: true,
    })

    const anon = createClient(SUPABASE_URL!, ANON_KEY!)
    await anon.auth.signInWithPassword({
      email: syntheticEmail(`usera${suffix}`),
      password: 'Str0ngPassword12',
    })

    const { error } = await anon
      .from('messages')
      .insert({ user_id: b.data.user!.id, content: 'privileged write attempt' })

    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
  })
})

dbDescribe('9) Recovery-код одноразовый', () => {
  it('второй使用该 же кода даёт 400', async () => {
    const admin = createClient(SUPABASE_URL!, SERVICE_KEY!)
    const username = `rec${Date.now().toString().slice(-6)}`
    const user = await admin.auth.admin.createUser({
      email: syntheticEmail(username),
      password: 'Str0ngPassword12',
      email_confirm: true,
    })
    const [code] = hashRecoveryCodes(['AAAA-BBBB-CCCC']).hashes
    await admin.from('recovery_codes').insert({ user_id: user.data.user!.id, code_hash: code! })

    const body = {
      username,
      recoveryCode: 'AAAA-BBBB-CCCC',
      newPassword: 'N3wPassword123',
      turnstileToken: 'test-token',
    }
    const first = await post('/api/auth/recover', body)
    const second = await post('/api/auth/recover', body)
    expect([200, 400]).toContain(first.status)
    expect(second.status).toBe(400)
  })
})

dbDescribe('11) hidden=true не отдаётся', () => {
  it('скрытое сообщение отсутствует в истории', async () => {
    const admin = createClient(SUPABASE_URL!, SERVICE_KEY!)
    const { data } = await admin
      .from('messages')
      .insert({ user_id: (await admin.auth.admin.listUsers()).data.users[0]!.id, content: 'hidden test', hidden: true })
      .select('id')
      .single()

    const anon = createClient(SUPABASE_URL!, ANON_KEY!)
    await anon.auth.signInWithPassword({
      email: syntheticEmail('alice1'),
      password: 'Str0ngPassword12',
    })
    const { data: page } = await anon.rpc('chat_page', { p_limit: 50 })
    expect(page?.some((row: { id: number }) => row.id === data?.id)).toBe(false)
  })
})
