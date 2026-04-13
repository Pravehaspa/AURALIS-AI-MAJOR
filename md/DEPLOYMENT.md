# Auralis AI Deployment Guide

## 1) Pre-deployment checklist

Run these commands locally before every release:

```bash
npm install
npm run predeploy:check
npm run ci
```

`npm run ci` runs lint, typecheck, unit tests, and production build.

## 2) Required environment variables

Set all of these in your hosting platform (Vercel/GitHub Actions/etc.):

```env
GOOGLE_AI_API_KEY=
MURF_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
NEXT_PUBLIC_APP_URL=
```

## 3) Vercel deployment

1. Import the repository into Vercel.
2. Add the required environment variables in Project Settings.
3. Deploy from `main` branch.
4. Verify `/api/health` returns `healthy` and no missing env keys.

## 4) Post-deployment smoke tests

- Open `/login` and verify Google sign-in redirect works.
- Open `/dashboard` and verify agent list loads.
- Open `/chat/1` and verify chat + TTS response.
- Enable Auto Mode and verify loop: listen → respond → speak → listen.

## 5) Security recommendations

- Never commit `.env`, `.env.local`, or API credential files.
- Rotate any previously exposed API keys immediately.
- Keep environment variables only in secret stores (Vercel, GitHub Secrets).
