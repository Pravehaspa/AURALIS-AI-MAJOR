# Supabase Schema and Data Flow

## Tables

### public.users

Purpose: Stores app profile data for each authenticated user.

Columns:

- id (uuid, PK, FK -> auth.users.id): Same ID as Supabase Auth user.
- name (text): Display name for UI.
- email (text, unique): Contact/login email.
- image (text, nullable): Avatar URL.
- provider (text): Login provider, for example email or google.
- created_at (timestamptz): Creation timestamp.
- updated_at (timestamptz): Last update timestamp.

### public.preferences

Purpose: Stores user app preferences.

Columns:

- user_id (uuid, PK, FK -> public.users.id): Owner user.
- theme (text): UI theme.
- language (text): Preferred language.
- notifications (boolean): Notification preference.
- response_style (text): AI response style preference.
- voice_enabled (boolean): Voice feature enabled state.
- volume_level (numeric): Voice volume preference.
- last_login (timestamptz, nullable): Last login time.
- deleted_at (timestamptz, nullable): Soft-delete marker.
- updated_at (timestamptz): Last update timestamp.

### public.chat_memory

Purpose: Stores user chat memory for personalization.

Columns:

- id (uuid, PK): Memory item ID.
- user_id (uuid, FK -> public.users.id): Owner user.
- message (text): User prompt content.
- response (text): Assistant response content.
- is_important (boolean): Priority marker for memory retrieval.
- timestamp (timestamptz): Creation timestamp.

## Data Flow: auth.users -> public.users

1. User signs up or signs in using Supabase Auth.
2. Supabase stores identity in auth.users.
3. Trigger on auth.users inserts or updates matching row in public.users.
4. Application also calls sync logic after login/signup to ensure profile consistency.
5. Preferences and chat_memory link to the same user ID via foreign keys.

## Access Rules

- RLS is enabled on users, preferences, and chat_memory.
- Policies allow each authenticated user to access only their own rows via auth.uid().
