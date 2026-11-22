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
