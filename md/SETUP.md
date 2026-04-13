# Auralis AI Setup Guide

## Prerequisites

- Node.js 20+
- npm 10+
- Google OAuth client credentials
- Google AI API key
- Murf AI API key
- Supabase project with PostgreSQL access

## Database Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run the schema from [supabase/schema.sql](supabase/schema.sql).
4. Confirm these tables exist:
   - `users`
   - `user_preferences`
   - `chat_memory`

The app uses PostgreSQL directly through `DATABASE_URL`, so the database connection string must point to the Supabase Postgres instance.

## Environment Variables

Create your local environment file from the template:

```bash
copy env.example .env.local
```

Set the following values in `.env.local`:

- `NEXTAUTH_URL` should be your local or production base URL.
- `NEXTAUTH_SECRET` should be a long random secret.
- `DATABASE_URL` should point to Supabase Postgres using the direct connection string format:
  - `postgresql://postgres:REAL_PASSWORD@db.<project-ref>.supabase.co:5432/postgres`
- Optional for IPv4-restricted networks: set `DATABASE_URL_POOLER` to your Supabase pooler connection string and `DATABASE_URL_USE_POOLER=1`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` should come from Google Cloud Console.
- `GOOGLE_AI_API_KEY` should be the Gemini key.
- `MURF_API_KEY` should be the Murf key.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Validate the environment and start the app:

```bash
npm run predeploy:check
npm run dev
```

3. Open `http://localhost:3000`.

## Auth Flow

- Visit `/signup` to create a password-based account.
- Visit `/login` to sign in with email/password.
- Use Google sign-in from either page for OAuth login.
- Protected routes include `/chat`, `/dashboard`, and `/settings`.

## Quality Checks

Run the full quality gate before pushing changes:

```bash
npm run ci
```

## Deployment Notes

- Set the same environment variables in Vercel.
- Make sure `NEXTAUTH_URL` matches the deployed domain.
- Run the Supabase schema before first deploy.
- Keep `DATABASE_URL` private and do not expose it in client code.

## Troubleshooting

- `Server is missing DATABASE_URL`: confirm the Supabase connection string is set.
- `DATABASE_URL still uses a placeholder password`: replace placeholder tokens with your real Supabase DB password.
- `Database Unreachable`: if direct URL fails on IPv4 networks, set `DATABASE_URL_POOLER` and `DATABASE_URL_USE_POOLER=1`.
- `Server is missing GOOGLE_AI_API_KEY`: add the key to `.env.local` and restart.
- `Server is missing MURF_API_KEY`: add the key to `.env.local` and restart.
- Google login fails: verify the OAuth callback URL and `NEXTAUTH_URL`.
- Credentials login fails after signup: confirm the `users` table exists and the password hash was stored.
