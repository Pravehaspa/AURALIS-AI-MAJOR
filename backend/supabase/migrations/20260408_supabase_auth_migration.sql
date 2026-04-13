-- Supabase Auth migration: remove custom password auth columns and bind users to auth.users

alter table if exists public.users
  alter column id drop default;

alter table if exists public.users
  add column if not exists image text,
  add column if not exists provider text not null default 'email';

update public.users
set provider = case
  when provider is null or provider = '' then 'email'
  when provider = 'credentials' then 'email'
  else provider
end;

-- Ensure id references auth.users, and remove legacy auth columns.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'password'
  ) then
    alter table public.users drop column password;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'google_id'
  ) then
    alter table public.users drop column google_id;
  end if;
end $$;

alter table if exists public.users
  drop constraint if exists users_id_fkey,
  add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;

create unique index if not exists idx_users_email_unique on public.users (email);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, image, provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_app_meta_data->>'provider', 'email')
  )
  on conflict (id)
  do update set
    name = excluded.name,
    email = excluded.email,
    image = coalesce(excluded.image, public.users.image),
    provider = excluded.provider,
    updated_at = now();

  insert into public.preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

alter table public.users enable row level security;
alter table public.preferences enable row level security;
alter table public.user_preferences enable row level security;
alter table public.chat_memory enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users for select to authenticated using (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users for insert to authenticated with check (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists preferences_select_own on public.preferences;
create policy preferences_select_own on public.preferences for select to authenticated using (auth.uid() = user_id);

drop policy if exists preferences_insert_own on public.preferences;
create policy preferences_insert_own on public.preferences for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists preferences_update_own on public.preferences;
create policy preferences_update_own on public.preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own on public.user_preferences for select to authenticated using (auth.uid() = user_id);

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own on public.user_preferences for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own on public.user_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists chat_memory_select_own on public.chat_memory;
create policy chat_memory_select_own on public.chat_memory for select to authenticated using (auth.uid() = user_id);

drop policy if exists chat_memory_insert_own on public.chat_memory;
create policy chat_memory_insert_own on public.chat_memory for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists chat_memory_update_own on public.chat_memory;
create policy chat_memory_update_own on public.chat_memory for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists chat_memory_delete_own on public.chat_memory;
create policy chat_memory_delete_own on public.chat_memory for delete to authenticated using (auth.uid() = user_id);
