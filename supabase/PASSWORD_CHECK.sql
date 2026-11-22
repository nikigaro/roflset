-- Один раз в SQL Editor. Нужно, чтобы вход по паролю работал без включённого провайдера Email.
create extension if not exists pgcrypto;

create or replace function public.verify_user_password(p_email text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  select encrypted_password into v_hash from auth.users where email = p_email;
  if v_hash is null then
    return false;
  end if;
  return crypt(p_password, v_hash) = v_hash;
end;
$$;

revoke all on function public.verify_user_password(text, text) from public;
grant execute on function public.verify_user_password(text, text) to service_role;
