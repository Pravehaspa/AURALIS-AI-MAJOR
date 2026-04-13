-- Cleanup duplicate preferences table and legacy auth columns in public.users.
-- Backup legacy data before removal.

create table if not exists public.user_preferences_backup as
select * from public.user_preferences;

alter table public.users
  drop column if exists password,
  drop column if exists google_id;

-- Keep users bound to Supabase Auth identities.
alter table public.users
  drop constraint if exists users_id_fkey,
  add constraint users_id_fkey
    foreign key (id)
    references auth.users(id)
    on delete cascade;

-- Canonical table is public.preferences.
drop table if exists public.user_preferences;
