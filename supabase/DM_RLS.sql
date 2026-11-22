-- Выполнить ОДИН РАЗ в Supabase SQL Editor.
-- Даёт читать hidden=true ЛС только участникам переписки.
-- Отправитель: auth.uid() = user_id
-- Получатель: content->>'to' = auth.uid()
-- Третий пользователь НЕ видит чужую переписку.

drop policy if exists "dm_select_participants" on public.messages;

create policy "dm_select_participants" on public.messages
  for select to authenticated
  using (
    hidden = true
    and content like '{%'
    and (content::jsonb ->> 'k') = 'dm'
    and (
      auth.uid() = user_id
      or (content::jsonb ->> 'to') = auth.uid()::text
    )
  );

-- Политика INSERT "messages_insert_own" уже требует auth.uid() = user_id,
-- поэтому подменить отправителя нельзя.
