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

insert into public.preferences (user_id, response_style, language, updated_at)
select user_id, response_style, coalesce(language, 'en'), coalesce(updated_at, now())
from public.user_preferences
on conflict (user_id) do nothing;
