create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  image text,
  provider text not null default 'email',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create table if not exists public.preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  theme text not null default 'dark',
  language text not null default 'en',
  notifications boolean not null default true,
  response_style text not null default 'detailed',
  voice_enabled boolean not null default true,
  volume_level numeric not null default 1,
  last_login timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists preferences_set_updated_at on public.preferences;
create trigger preferences_set_updated_at
before update on public.preferences
for each row
execute function public.set_updated_at();

create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  response_style text not null default 'detailed',
  language text,
  updated_at timestamptz not null default now()
);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

create table if not exists public.chat_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  response text not null,
  is_important boolean not null default true,
  timestamp timestamptz not null default now()
);

create index if not exists idx_chat_memory_user_timestamp on public.chat_memory (user_id, timestamp desc);
create index if not exists idx_chat_memory_user_important on public.chat_memory (user_id, is_important);

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
create policy users_select_own on public.users
for select
to authenticated
using (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists preferences_select_own on public.preferences;
create policy preferences_select_own on public.preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists preferences_insert_own on public.preferences;
create policy preferences_insert_own on public.preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists preferences_update_own on public.preferences;
create policy preferences_update_own on public.preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own on public.user_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own on public.user_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists chat_memory_select_own on public.chat_memory;
create policy chat_memory_select_own on public.chat_memory
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists chat_memory_insert_own on public.chat_memory;
create policy chat_memory_insert_own on public.chat_memory
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists chat_memory_update_own on public.chat_memory;
create policy chat_memory_update_own on public.chat_memory
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists chat_memory_delete_own on public.chat_memory;
create policy chat_memory_delete_own on public.chat_memory
for delete
to authenticated
using (auth.uid() = user_id);
