# Let Me Finish

*Your voice. Your words. Your pace.*

A patient, private speech companion for adults who stammer. Built from the *Let Me Finish Development Blueprint* (v1.0, Nov 2026). It is a **working concept, not a clinically validated product**: it does not diagnose, treat or promise fluency.

## The one promise, in code
A person's turn stays open through silence, blocks, repetitions and speech-engine time-outs. **Only "I'm finished" ends it** (automatic end-of-turn is opt-in, and never fires before they have said something). That rule lives in a pure state machine (`src/lib/conversation/machine.ts`) with fuzz tests, and is checked again in the controller and in a real browser with a scripted microphone.

## What's here
- **Talk**: 11 scenes (friend, lecturer, recruiter, cashier, colleague, phone agent…), your own scenes, phone calls with a ring, voice or typing, pause/stop at any time, transcript correction, reply reporting, crisis support panel.
- **Two partners**: an AI partner (Claude, via `/api/v1/roleplays/{id}/turns`, streamed and checked sentence by sentence against the behaviour contract) and an offline scripted partner. The app falls back to the script automatically.
- **Today / Practice / Library / Journeys / Progress / Settings / Support**; user-reported ratings only; no streaks, scores or ranking.
- **Privacy**: local-first; recording never stored; separate versioned consents (microphone, AI, transcripts); retention windows; export, import, delete everything.
- **Accessibility**: keyboard, skip link, native dialogs, 200% text options, reduced motion, high contrast, text-only mode; axe checks in CI.
- **Offline**: service worker caches lessons and tools; API calls are never cached.
- **Supabase schema** with row-level security (`supabase/migrations`), tested on real Postgres: users cannot read or write each other's rows.

## Run it
```bash
npm install
npm run dev            # http://localhost:3000
npm test               # 154 unit tests
npm run build && npm run test:e2e
```
Copy `.env.example` to `.env.local` to enable the AI partner or reporting inbox.

## Not done yet — be honest before launch
1. **Clinical review.** All lesson content is marked *Awaiting clinical review*. A licensed speech-language therapist must review it (and the AI prompt in `src/lib/conversation/prompt.ts`) before any public use. Research citations were deliberately left out because they could not all be verified.
2. **The AI route has not been run against the live Claude API** (no key was available while building). Run it with a key and test refusals, rate limits and cost before release.
3. **On-device speech recognition** (audio never leaves the device) is not built. Voice uses the browser's own speech service (Chrome/Edge/Safari), which may send audio to the browser vendor; the consent text says so. Firefox falls back to typing.
4. **Accounts and sync**: schema exists; sign-in and sync UI are not wired up. The app is guest-only today.
5. Spending limits are in-memory per server instance; use a shared store before public launch.
6. Crisis-line numbers were checked on 2026-11-10 against public listings; re-verify regularly. NZ and ZA stammering-group links need checking. Legal/privacy review, trademark checks, and usability testing with people who stammer (blueprint §11–12, §17) are still required.
