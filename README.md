# РофлСеть

РофлСеть — соцсеть с безопасной регистрацией. **Реализованы ЭТАП 1 и ЭТАП 2** (синтетический email, регистрация, вход, профиль, recovery-коды, `/recover`, общий чат с Realtime, жалобы и модерация).

## Стек

- TypeScript `strict: true` + `noUncheckedIndexedAccess`, только `.ts` / `.tsx`
- Next.js 15 App Router, React 19
- Supabase: PostgreSQL + Auth + Realtime (в этапе 1 Realtime не используется)
- `@supabase/supabase-js` + `@supabase/ssr` (Prisma **не используется**)
- Tailwind CSS v4, единый шрифт интерфейса — Subkultur (`src/fonts/Subkultur-Regular-Trial.ttf`, подключён через `next/font/local` в `src/lib/font.ts`)
- Логотип и фавикон цвета `#115eea`: `public/logo.png`, `src/app/icon.png`; иконки темы/чата/профиля — серые с прозрачным фоном
- Cloudflare Turnstile (проверка токена на сервере)
- Деплой: Vercel

## Локальный запуск

1. Создайте проект Supabase.
2. В **SQL Editor** выполните по порядку:
   - [`supabase/migrations/20261122000000_stage1_auth.sql`](supabase/migrations/20261122000000_stage1_auth.sql)
   - [`supabase/migrations/20261122010000_stage2_chat.sql`](supabase/migrations/20261122010000_stage2_chat.sql)
3. Задеплойте Edge Function модерации: `npx supabase functions deploy moderate-message` и укажите её URL в `MODERATION_FUNCTION_URL`.
4. Supabase → **Authentication → Providers → Email**:
   - `Enable email provider` — включено;
   - `Confirm email` — **ВЫКЛЮЧЕНО** (иначе вход невозможен);
   - `Secure email change` — **ВЫКЛЮЧЕНО**;
   - `Allow new users to sign up` — включено;
   - `Minimum password length` — 8 (в приложении строже: 12);
   - `Leaked Password Protection` — опция платная (Pro), поэтому не включаем: политику паролей (12 символов, буквы и цифра) приложение проверяет само.
5. Supabase → **Authentication → URL Configuration**: добавьте `http://localhost:3000` и ваш Vercel-домен в Site URL / Redirect URLs.
6. Cloudflare → **Turnstile**: создайте виджет. Тестовые ключи для локальной разработки: site key `1x00000000000000000000AA`, secret key `1x0000000000000000000000000000000AA`.
7. Скопируйте `.env.example` в `.env.local` и заполните значения, включая **серверный** `SUPABASE_SERVICE_ROLE_KEY`. Никогда не коммитьте `.env.local` и не добавляйте service role key в `NEXT_PUBLIC_*`.
8. Установите и запустите:

```bash
npm install
npm run check     # tsc --noEmit && next build
npm run dev
```

## Типы БД

`src/types/database.types.ts` создан в формате `supabase gen types typescript` и **должен перегенерироваться** при каждом изменении схемы:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npm run gen:types
```

Все обращения к БД типизированы через `Database` (`src/lib/supabase/*.ts`).

## Маршруты

| Маршрут | Назначение |
| --- | --- |
| `/register` | username, password, confirmPassword, Turnstile. После успеха — 10 кодов один раз + «Скачать .txt» + чекбокс подтверждения |
| `/login` | username, password, Turnstile |
| `/recover` | username + recovery-код + новый пароль + Turnstile |
| `/profile` | защищён; username + «Выйти» |
| `/chat` | защищён; «Стена», история по 50, Realtime, жалобы |
| `POST /api/auth/register` | rate limit → валидация → зарезервированные ники (400) → Turnstile (400) → signUp → авто-вход → генерация и запись 10 хэшей |
| `POST /api/auth/login` | rate limit (IP + username) → валидация → Turnstile → signInWithPassword |
| `POST /api/auth/recover` | rate limit (IP + username) → Turnstile → поиск user_id → проверка кода → атомарная пометка `used_at` → `admin.updateUserById` → `admin.signOut(global)` |
| `POST /api/logout` | `auth.signOut()` + удаление всех кук `sb-*` |
| `GET /api/chat/messages` | история 50 сообщений, курсор `created_at\|id` через `chat_page` |
| `POST /api/chat/messages` | отправка: Content-Length, валидация, мут, RLS INSERT, вызов модерации |
| `POST /api/chat/report` | жалоба с UNIQUE(message_id, reporter_id) |
| `POST /api/profile/avatar` | загрузка сжатого WebP-аватара в Storage (`avatars/<user_id>/avatar.webp`) |
| `POST /api/profile/password` | смена пароля с проверкой текущего и отзывом всех сессий |

## Синтетический email

Supabase Auth требует email. Он создаётся **только** в `src/lib/shared-utils.ts`:

```ts
syntheticEmail('alice') // alice@users.prostoset.test
```

Домен `users.prostoset.test` — внутренний идентификатор, пользователю не виден. `.invalid` Supabase Auth отклоняет как невалидный адрес, поэтому используется `.test` (также зарезервирован RFC 2606). Домен `.test` зарезервирован RFC 2606: он гарантированно не существует, письма не уходят, адрес нельзя занять. Email не отдаётся на клиент, не логируется и не показывается в UI. Ошибки Supabase вида «email already exists» перехватываются в API и заменяются нейтральным сообщением «Не удалось зарегистрироваться. Попробуйте другой юзернейм или войдите».

## Recovery-коды

- Сервер генерирует **10 кодов** формата `XXXX-XXXX-XXXX` через `crypto.randomBytes` (`src/lib/recovery-codes.ts`).
- Хранится только `соль(16 байт) + SHA256(соль || код)` = 96 hex в `code_hash`. Открытый вид не сохраняется.
- Пользователь видит коды **один раз** сразу после регистрации, может скачать `.txt`. В `/profile` коды не показываются.
- `public.recovery_codes`: `id bigint IDENTITY PK`, `user_id uuid`, `code_hash text`, `used_at`, `created_at`.
- RLS включена, но **политик для anon/authenticated нет** — SELECT/INSERT/UPDATE/DELETE клиентам запрещены. Доступ только через service role (`src/lib/supabase/admin.ts`).
- `/recover`: код проверяется сравнением в постоянное время по всем неиспользованным кодам, затем атомарно помечается `used_at`, пароль меняется через `admin.updateUserById`, все сессии отзываются через `admin.signOut(userId, 'global')`. Повторное использование → **400**.

## Пароли и сессии

- Пароли хешируются **только Supabase Auth** (bcrypt); собственного хешера нет. Пароль не логируется и не возвращается в API-ответах.
- Учётные записи создаются через `auth.admin.createUser`, сессия выдаётся через серверный magic-link + `verifyOtp` (`src/lib/session.ts`) — письма не отправляются, подтверждение почты не требуется. Вход использует обычный `signInWithPassword` (fallback — SQL-функция `PASSWORD_CHECK.sql`).
- Сессия живёт в куках `httpOnly; Secure (только HTTPS); SameSite=Lax; Path=/` — настройки в `src/lib/supabase/cookie-options.ts`, используемые браузерным, серверным клиентом и middleware. `localStorage` для сессии не используется.
- Ротация refresh-токенов не отключалась: middleware вызывает `auth.getUser()`, который обновляет токены.
- Выход: `supabase.auth.signOut()` + удаление всех кук `sb-*` (`src/app/api/logout/route.ts`).

## Заголовки безопасности

`src/middleware.ts` выставляет CSP с per-request nonce (Next.js подхватывает его для inline-скриптов), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` и `Strict-Transport-Security: max-age=31536000; includeSubDomains` **только по HTTPS**. Дополнительные заголовки продублированы в `next.config.ts`.

CSP: `script-src 'self' 'nonce-…' https://challenges.cloudflare.com`, `connect-src 'self' https://*.supabase.co wss://*.supabase.co`, `frame-src https://challenges.cloudflare.com`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`; плюс `style-src`, `img-src`, `font-src` для Next.js и виджета Turnstile.

## Ключи Supabase

- Клиент: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) или legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` — приоритет у publishable (`src/lib/supabase/keys.ts`).
- Сервер: `SUPABASE_SERVICE_ROLE_KEY` / secret key — только в `src/lib/supabase/admin.ts` и серверных Route Handlers.
- Проверка бандла: `grep` по `.next/static` на `sb_secret_` и `service_role` должен быть пустым.

## CSRF

`src/lib/csrf.ts` проверяет заголовок `Origin` для всех POST/PUT/DELETE Route Handlers. Вместе с `SameSite=Lax` это достаточно для MVP. При необходимости задайте `APP_ORIGIN` (точный origin продакшена).

## Источник иконок

Все значки взяты отсюда: https://www.magnific.com/ru/author/magnific/icons/basic-rounded-lineal_4#uuid=8beb5a7f-ea55-4a87-97a5-867d5b3b0361

## Заготовленные иконки

`public/icons/profile.png` и `public/icons/chat.png` — серые иконки с прозрачным фоном, сохранены заранее для этапа 2.

## Аватары

В профиле можно поставить фото: браузер сжимает его до WebP 256×256, качество 0.8 (`src/lib/image.ts`), сервер проверяет тип/размер и загружает через service role в публичный бакет `avatars` (`src/app/api/profile/avatar/route.ts`). Клиент не может писать в Storage напрямую. Ключ кэша обновляется добавлением `?v=timestamp`.

## Этап 2: Стена (общий чат)

- Один канал `general` на всех (`src/app/chat/page.tsx`, `chat-client.tsx`). История — 50 сообщений на страницу, курсор `(created_at, id)`; SQL-функция `public.chat_page` работает с `SECURITY INVOKER`, поэтому RLS не обходится.
- Realtime: **Postgres Changes** на `public.messages` (таблица добавлена в `supabase_realtime`, `replica identity full`). RLS не отключался; подписка создаётся клиентом через `@supabase/ssr` и удаляется при размонтировании (одна подписка на вкладку).
- **XSS**: сообщение рендерится только как `{message.content}`, `dangerouslySetInnerHTML` не используется. Сервер отклоняет пустые сообщения, >2000 символов, null-байты, любые управляющие символы и `<`/`>` (`src/lib/validation.ts`). HTML не сохраняется.
- **Анти-спам**: 10 сообщений/минуту на `user_id` + мут 60 сек (`public.chat_mutes`, `check_chat_rate_limit`); клиенту возвращается понятное сообщение с оставшимся временем. Заголовок `Content-Length` проверяется на сервере (лимит 8 КБ).
- **Модерация**: Edge Function `supabase/functions/moderate-message/index.ts` проверяет запрещённые слова и ставит `hidden = true` через service role. Скрытое сообщение не проходит RLS SELECT и убирается из UI событием UPDATE.
- **Жалобы**: `public.reports` с `UNIQUE(message_id, reporter_id)`; RLS INSERT только от своего имени, SELECT только service_role. Повторная жалоба → понятная ошибка.

## Ошибки, логирование и секреты

- API не возвращает stack trace и детали БД — только нейтральный `{ error, message }`.
- `src/middleware.ts` выдаёт `x-correlation-id` на каждый запрос; `src/lib/security.ts` пишет структурированные события без PII (нет паролей, токенов, recovery-кодов, email, username, IP): вход, регистрация, восстановление, rate limit, жалобы.
- `.gitignore` закрывает все `.env*` (кроме `.env.example`). На Vercel переменные задаются в Project Settings → Environment Variables. Проверка бандла: `grep` по `.next/static` на `sb_secret_` и `service_role` — пусто.

## Тесты

```bash
npm run test      # vitest
```

`tests/auth-and-chat.test.ts`: 6 юнит-тестов выполняются всегда (невалидный/верхний регистр username, `<script>` как текст и отсутствие HTML-рендера, null-байты/управляющие символы, `.invalid`-домен). Интеграционные тесты (3, 4, 5, 7, 8, 9, 10, 11) автоматически пропускаются без `TEST_BASE_URL` / ключей Supabase; для запуска задайте `TEST_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

`npm audit --omit=dev`: 0 уязвимостей (PostCSS обновлён через `overrides`, Zod обновлён до v4).

## Чек-лист Supabase Dashboard

Перед релизом: **Security Advisor → исправить ВСЕ предупреждения**, особенно «RLS enabled but no policy» и `function search_path`. В миграциях задан `SET search_path = ''` для всех `SECURITY DEFINER` функций, RLS включена на всех пользовательских таблицах, явные GRANT есть у `authenticated`/`service_role`, `anon` не имеет прав.

## Защита от атак

- **Turnstile** обязателен на регистрации, входе и восстановлении: токен проверяется на сервере через `siteverify` **до** `signUp`; без валидного токена — `400`.
- **Rate limit** (`src/lib/rate-limit.ts`, таблица `public.rate_limits` + функция `check_rate_limit`):
  - `register` — 3 попытки/час на IP;
  - `login` — 5 попыток/минуту на IP **и** 5 на username;
  - `recover` — 3 попытки/час на IP **и** 3 на username.
  При недоступности БД лимит считается исчерпанным (fail closed). IP берётся из `x-forwarded-for` / `x-real-ip`.
- **Задержка 500–800 мс** (`antiTimingDelay()` в `src/lib/shared-utils.ts`) на всех неудачных ответах register/login/recover.
- **Единые сообщения** (без enumeration): вход — «Неверный юзернейм или пароль»; занятый ник при регистрации — «Не удалось зарегистрироваться. Попробуйте другой юзернейм или войдите»; восстановление — «Неверный юзернейм или recovery-код».
- **Username** строго `/^[a-z][a-z0-9]{2,19}$/` на клиенте и сервере; сервер не делает `trim()` и не меняет регистр — всё неподходящее отклоняется.
- **Темы**: переключатель в шапке (`src/components/theme-toggle.tsx`), иконка `public/theme-icon.png` с прозрачным фоном (серая, видна на белом и чёрном фоне). Выбор сохраняется в `localStorage`, применяется до отрисовки inline-скриптом в `layout.tsx`.

## Ключевые решения по безопасности (этап 1)

- **Username**: `/^[a-z][a-z0-9]{2,19}$/` в Zod, БД (check constraint) и триггере; 11 зарезервированных ников → HTTP 400 + таблица `reserved_usernames`.
- **Пароли**: 12–128 символов, строчная + заглавная буква + цифра; общая Zod-схема клиент/сервер.
- **Turnstile**: токен проверяется сервером (`siteverify`), виджет сбрасывается после ошибки; нет обходных флагов в проде.
- **Сессии**: middleware обновляет сессию и защищает `/profile`; `getUser()` вместо `getSession()`; logout чистит куки `sb-*`.
- **Service role key** используется только в серверных API-роутах, никогда не попадает в клиентский бандл.
- **Перечисление пользователей**: `/api/login` и `/api/recover` возвращают одинаковое сообщение для неверного логина/кода; `/api/register` — нейтральное сообщение при любом conflicts-ответе Supabase.
- **Заголовки ответов**: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (`next.config.ts`).

## RLS-политики

- `profiles_select_own` — `SELECT TO authenticated USING (auth.uid() = id)`
- `reserved_usernames_select_all` — `SELECT TO authenticated USING (true)`
- `recovery_codes` и `rate_limits` — **политик нет**; только service_role (обходит RLS)
- Запись в `profiles` идёт через `SECURITY DEFINER` триггер `handle_new_user()` с `SET search_path = ''`.
