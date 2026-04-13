# Release Notes

## v1.0.0 (2026-02-19)

### Security

- Removed hardcoded API keys and secrets from tracked files.
- Added strict server-side key checks for AI and TTS routes.
- Updated `.gitignore` to block accidental env/API credential commits.

### Voice & Chat

- Reworked chat architecture to call server APIs for generation and speech.
- Implemented complete voice lifecycle: listen → react → speak → restart listening in auto mode.
- Added manual mic controls and auto-mode toggle in chat UI.

### Quality & Delivery

- Added predeploy env validation script (`scripts/predeploy-check.mjs`).
- Added unit test setup with Vitest (`lib/env.test.ts`).
- Added CI pipeline in `.github/workflows/ci.yml`.
- Added `typecheck`, `test`, and `ci` npm scripts.

### Docs

- Replaced setup/deployment docs with production-safe runbooks.
- Added explicit verification and smoke-test steps.
