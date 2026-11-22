-- РофлСеть: полная установка (этап 1 + этап 2)

-- РофлСеть / Этап 1: регистрация по username + password, RLS, recovery-коды.
-- Выполнить в Supabase SQL Editor (или через `supabase db push`).
--
-- В Dashboard дополнительно:
--   Auth -> Providers -> Email -> "Confirm email" = OFF
--   Auth -> Providers -> Email -> "Secure email change" = OFF

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z][a-z0-9]{2,19}$')
);

-- code_hash = 32 hex (соль) + 64 hex (SHA256 соли и кода) = 96 hex.
create table if not exists public.recovery_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint recovery_codes_hash_format check (code_hash ~ '^[a-f0-9]{96}$')
);

create index if not exists recovery_codes_user_id_idx on public.recovery_codes (user_id);

create table if not exists public.reserved_usernames (
  username text primary key
);

insert into public.reserved_usernames (username)
values
  ('admin'), ('root'), ('support'), ('moderator'), ('system'),
  ('null'), ('undefined'), ('api'), ('help'), ('official'), ('prostoset'), ('rofset')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.recovery_codes enable row level security;
alter table public.reserved_usernames enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "reserved_usernames_select_all" on public.reserved_usernames;
create policy "reserved_usernames_select_all" on public.reserved_usernames
  for select to authenticated
  using (true);

-- recovery_codes: НЕТ политик ни для anon, ни для authenticated.
-- SELECT/INSERT/UPDATE/DELETE клиентам запрещены; работает только service_role.

-- Явные гранты: anon не получает прав ни на одну пользовательскую таблицу.
revoke all on public.profiles, public.recovery_codes, public.reserved_usernames from anon;

grant usage on schema public to authenticated, service_role;
grant select on public.profiles to authenticated;
grant select on public.reserved_usernames to authenticated;

grant select on public.profiles to service_role;
grant select, insert, update, delete on public.recovery_codes to service_role;

-- ---------------------------------------------------------------------------
-- Триггер: создаёт профиль с username из raw_user_meta_data.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := nullif(new.raw_user_meta_data ->> 'username', '');
begin
  if v_username is null or v_username !~ '^[a-z][a-z0-9]{2,19}$' then
    raise exception 'invalid username';
  end if;

  if exists (select 1 from public.reserved_usernames r where r.username = v_username) then
    raise exception 'reserved username';
  end if;

  insert into public.profiles (id, username)
  values (new.id, v_username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Rate limit: только service_role (RLS включена, политик нет).
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limits (
  ip text not null,
  key text not null,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  primary key (ip, key)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant select, insert, update, delete on public.rate_limits to service_role;

create or replace function public.check_rate_limit(
  p_ip text,
  p_key text,
  p_window_seconds integer,
  p_max integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_start timestamptz;
  v_count integer;
begin
  select window_start, count into v_start, v_count
  from public.rate_limits
  where ip = p_ip and key = p_key
  for update;

  if not found or v_start is null or v_start < v_now - (p_window_seconds || ' seconds')::interval then
    insert into public.rate_limits (ip, key, window_start, count)
    values (p_ip, p_key, v_now, 1)
    on conflict (ip, key) do update
      set window_start = excluded.window_start, count = 1;
    return true;
  end if;

  if v_count >= p_max then
    return false;
  end if;

  update public.rate_limits set count = v_count + 1 where ip = p_ip and key = p_key;
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;


-- РофлСеть / Этап 2: общий чат, жалобы, анти-спам, Realtime.

-- ---------------------------------------------------------------------------
-- Сообщения
-- ---------------------------------------------------------------------------

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint messages_content_length check (char_length(content) between 1 and 2000)
);

create index if not exists messages_created_at_idx on public.messages (created_at desc, id desc);
create index if not exists messages_user_created_idx on public.messages (user_id, created_at desc);

alter table public.messages enable row level security;
alter table public.messages replica identity full;

drop policy if exists "messages_select_visible" on public.messages;
create policy "messages_select_visible" on public.messages
  for select to authenticated
  using (hidden = false);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages
  for insert to authenticated
  with check (auth.uid() = user_id);

-- UPDATE/DELETE для authenticated политик нет: только service_role.

revoke all on public.messages from anon;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.messages to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: Postgres Changes + RLS (RLS не отключаем).
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Жалобы
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.messages (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint reports_message_reporter_unique unique (message_id, reporter_id)
);

create index if not exists reports_message_idx on public.reports (message_id);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

-- SELECT только service_role: политик для authenticated/anon нет.

revoke all on public.reports from anon;
grant insert on public.reports to authenticated;
grant select on public.reports to service_role;

-- ---------------------------------------------------------------------------
-- Анти-спам: 10 сообщений/минуту на пользователя + мут 60 сек.
-- ---------------------------------------------------------------------------

create table if not exists public.chat_mutes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  muted_until timestamptz not null
);

alter table public.chat_mutes enable row level security;
revoke all on public.chat_mutes from anon, authenticated;
grant select, insert, update, delete on public.chat_mutes to service_role;

create or replace function public.check_chat_rate_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_muted_until timestamptz;
  v_allowed boolean;
begin
  select muted_until into v_muted_until from public.chat_mutes where user_id = p_user_id;

  if v_muted_until is not null and v_muted_until > v_now then
    return jsonb_build_object(
      'allowed', false,
      'muted', true,
      'retry_after', greatest(1, ceil(extract(epoch from v_muted_until - v_now))::int)
    );
  end if;

  v_allowed := public.check_rate_limit(p_user_id::text, 'chat:user', 60, 10);

  if not v_allowed then
    insert into public.chat_mutes (user_id, muted_until)
    values (p_user_id, v_now + interval '60 seconds')
    on conflict (user_id) do update set muted_until = excluded.muted_until;
    return jsonb_build_object('allowed', false, 'muted', true, 'retry_after', 60);
  end if;

  return jsonb_build_object('allowed', true, 'muted', false, 'retry_after', 0);
end;
$$;

revoke all on function public.check_chat_rate_limit(uuid) from public;
grant execute on function public.check_chat_rate_limit(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Чтение истории с курсором (created_at, id). RLS сохраняется при SECURITY INVOKER.
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select to authenticated
  using (true);
-- В profiles только id, username, created_at — email/телефона нет.

create or replace function public.chat_page(
  p_cursor timestamptz default null,
  p_cursor_id bigint default null,
  p_limit integer default 50
)
returns table (
  id bigint,
  user_id uuid,
  content text,
  created_at timestamptz,
  username text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, m.user_id, m.content, m.created_at, p.username
  from public.messages m
  join public.profiles p on p.id = m.user_id
  where m.hidden = false
    and (p_cursor is null or (m.created_at, m.id) < (p_cursor, p_cursor_id))
  order by m.created_at desc, m.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.chat_page(timestamptz, bigint, integer) from public;
grant execute on function public.chat_page(timestamptz, bigint, integer) to authenticated;
