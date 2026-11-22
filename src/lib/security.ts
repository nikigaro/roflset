/**
 * Структурное логирование событий безопасности.
 * Никаких паролей, токенов, recovery-кодов, email, username и IP.
 */
export type SecurityEvent =
  | 'login_success'
  | 'login_failure'
  | 'register_success'
  | 'register_failure'
  | 'recover_success'
  | 'recover_failure'
  | 'rate_limit'
  | 'report_created'
  | 'avatar_updated'
  | 'password_changed'
  | 'content_deleted'

export function logSecurityEvent(
  event: SecurityEvent,
  correlationId: string,
  meta: Record<string, string | number | boolean> = {},
): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      correlation_id: correlationId,
      ...meta,
    }),
  )
}
