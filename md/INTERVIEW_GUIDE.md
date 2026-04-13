# Interview Guide: What Was Completed

## 1) Problem framing

The project had five release blockers:

1. Secrets were committed in repo files.
2. Client-side chat code directly used AI keys.
3. Voice loop was partial and not lifecycle-safe.
4. No enforceable test/CI quality gate.
5. Deployment docs were not production-safe.

## 2) Architecture decisions

- Moved all model and TTS calls behind server routes (`/api/generate-response`, `/api/text-to-speech`) so secrets never reach the browser.
- Kept UI responsive by separating state for text generation and audio generation.
- Implemented speech recognition lifecycle controls to avoid overlap between listening and speaking.

## 3) Security changes

- Removed hardcoded credentials from templates/docs.
- Added env validation utility (`lib/env.ts`) and predeploy script (`scripts/predeploy-check.mjs`).
- Updated git ignore patterns for env files and API credential directory.

## 4) Voice flow completion

In chat:

- `Start Listening` captures transcript.
- Transcript triggers server-side AI response.
- Response triggers server-side TTS.
- Audio playback triggers auto-listen restart when Auto Mode is ON.
- Listening is paused during generation/playback to avoid self-capture.

## 5) DevEx and release readiness

- Added `npm run ci` quality gate: lint + typecheck + test + build.
- Added GitHub Actions CI workflow to enforce checks on push/PR.
- Bumped release version to `1.0.0` and published release notes.

## 6) What still requires owner action

- Add real keys in secret stores (Vercel/GitHub Secrets).
- Rotate any keys that were previously exposed.
- Run post-deploy smoke tests on production URL.
