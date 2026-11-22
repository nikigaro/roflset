import { z } from 'zod'

export const USERNAME_PATTERN = /^[a-z][a-z0-9]{2,19}$/

// Регистр и пробелы НЕ исправляются: всё, что не подходит под шаблон, отклоняется.
export const usernameSchema = z
  .string()
  .regex(USERNAME_PATTERN, 'Только строчные латинские буквы и цифры, 3–20 символов, первая — буква')

export const passwordSchema = z
  .string()
  .min(12, 'Минимум 12 символов')
  .max(128, 'Максимум 128 символов')
  .regex(/[a-z]/, 'Нужна хотя бы одна строчная буква')
  .regex(/[A-Z]/, 'Нужна хотя бы одна заглавная буква')
  .regex(/[0-9]/, 'Нужна хотя бы одна цифра')

export const recoveryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/, 'Неверный формат кода восстановления')

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  turnstileToken: z.string().min(1, 'Пройдите проверку Turnstile'),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
})

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128),
  turnstileToken: z.string().min(1, 'Пройдите проверку Turnstile'),
})

export const recoverSchema = z.object({
  username: usernameSchema,
  recoveryCode: recoveryCodeSchema,
  newPassword: passwordSchema,
  turnstileToken: z.string().min(1, 'Пройдите проверку Turnstile'),
})

/**
 * Сообщения чата: только текст. Управляющие символы и null-байты запрещены.
 * "<script>" допускается как обычный текст и рендерится через {content},
 * а не как HTML.
 */
export const messageContentSchema = z
  .string()
  .min(1, 'Сообщение не может быть пустым')
  .max(2000, 'Максимум 2000 символов')
  .refine((value) => !/[\u0000-\u001F\u007F-\u009F]/.test(value), 'Недопустимые управляющие символы')
  .refine((value) => value.trim().length > 0, 'Сообщение не может быть пустым')

export const sendMessageSchema = z.object({
  content: messageContentSchema,
})

export const reportSchema = z.object({
  messageId: z.number().int().positive(),
  reason: z.enum(['spam', 'abuse', 'other']),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RecoverInput = z.infer<typeof recoverSchema>
