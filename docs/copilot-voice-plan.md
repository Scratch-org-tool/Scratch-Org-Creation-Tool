# AI Copilot Voiceover — Analysis & Plan

The request: the AI Copilot works by typing today. Add a **voice mode** so a user can talk to it and
hear spoken replies. When the user flips a **mic toggle** the Copilot starts **listening in the
background**; if nothing relevant is said within ~2–3 seconds it stops listening on its own. When the
user asks something about the app/module, the answer is **spoken back**. Saying a wake phrase
(**“Hey Copilot” / “Hey Assistant”**) makes it **greet the user by their name** and then take the
command. Crucially, the whole feature is **admin-controlled** — it stays off until an administrator
turns it on.

## 1. What exists today

| Piece | Where | Notes |
|-------|-------|-------|
| Copilot panel (chat UI) | `apps/web/src/modules/ai-copilot/copilot-panel.tsx` | Text-only: textarea + send, streaming replies, launcher FAB. |
| Copilot store | `apps/web/src/store/index.ts` | Zustand: messages, streaming status, `sendMessage` flow lives in the panel. |
| Streaming client | `apps/web/src/hooks/use-copilot-stream.ts` | NDJSON stream from `POST /copilot/chat/stream`. |
| Copilot context | `apps/web/src/hooks/use-copilot-context.ts` | Page/module/role context; also exposes the signed-in user. |
| Browser TTS (reference) | `apps/web/src/modules/learning/use-speech.ts` | Proven `speechSynthesis` wrapper (voice pick, Chrome keepalive). Reused as the design basis. |
| Copilot API | `apps/api/src/modules/copilot/*` | `CopilotController` (`@RequireModule('copilot')`), `CopilotService`. |
| Admin-controlled global setting (reference) | Notifications: `NotificationSetting` model, `notifications.service.ts`, `admin/notifications` page | The exact pattern this feature mirrors — one global "off by default" row, admin-only writes. |
| User name | `UserAccessProfile.displayName` (client `useAuth().profile`, server `req.userProfile`) | Used for the greeting. |

The Web Speech API gives us both halves in the browser with no new server dependency:
**speech-to-text** via `SpeechRecognition` / `webkitSpeechRecognition`, and **text-to-speech** via
`speechSynthesis` (already used by the Academy).

## 2. Admin control (mirrors Notifications)

A single global row, **off by default**, that only an admin can change.

- **DB**: new `CopilotVoiceSetting` model (id `"global"`), same shape/discipline as `NotificationSetting`.
- **Shared** (`@sfcc/shared` `copilot-voice.ts`): `CopilotVoiceSettings`, `DEFAULT_COPILOT_VOICE_SETTINGS`
  (`enabled: false`), `normalizeCopilotVoiceSettings`, `applyCopilotVoiceSettingsUpdate`, and the Zod
  `copilotVoiceSettingsUpdateSchema`.
- **API** (`CopilotController`, already `@RequireModule('copilot')`):
  - `GET /copilot/voice-settings` → any Copilot user (read is safe — it is only feature flags, wake
    words and a greeting template; the client needs it to decide whether to show the mic).
  - `PATCH /copilot/voice-settings` → `@RequireRole('admin')` only.
- **Admin UI**: `apps/web/src/modules/admin/copilot-voice/` workspace + `admin/copilot-voice` route +
  a new `ADMIN_NAV_ITEMS` entry, styled like the Notifications console (master switch card + option
  toggles + Save/Discard).

Admin-tunable fields: `enabled`, `speakResponses`, `autoListen`, `wakeWords[]`, `greetingTemplate`
(`{name}` placeholder), `listenSilenceMs` (the 2–3 s window), `speechRate`, `voiceLang`.

## 3. Voice behaviour (client)

New colocated hooks under `apps/web/src/hooks/`:

- `use-voice-settings.ts` — fetches `/copilot/voice-settings` (gated on the `copilot` module) and
  reports `{ settings, enabled, loading }`. Drives whether the mic UI renders at all.
- `use-speech-recognition.ts` — thin, SSR-safe wrapper over `SpeechRecognition`: `supported`,
  `listening`, interim/final transcript, `start/stop`, and an `onResult` callback. Continuous +
  interim results so wake words and silence can be tracked live.
- `use-speech-synthesis.ts` — compact `speechSynthesis` wrapper (defer-after-cancel + keepalive, the
  same quirks the Academy hook handles) exposing `speak/cancel/speaking/supported`.
- `use-copilot-voice.ts` — the orchestrator that ties them together and to the Copilot store.

Orchestrator state machine, matching the request:

1. **Toggle on** → open the panel and `start()` recognition (background listening). Status: `listening`.
2. **Silence window** → a `listenSilenceMs` (default 2500 ms) timer runs. Every time a *relevant*
   utterance arrives (a wake word or a real command) it resets. If it fires with nothing relevant,
   recognition **auto-stops** (mic returns to idle) — the "stop background listening after 2–3 s"
   behaviour.
3. **Wake word** (`matchesWakeWord`, e.g. "hey copilot", "hey assistant") → **speak the greeting**
   rendered from `greetingTemplate` + `displayName` ("Hi Ajay, how can I help you today?"), then keep
   listening for the command. Any words after the wake word in the same phrase are treated as the
   command.
4. **Command** (a final transcript that is not just a wake word) → sent through the existing
   `sendMessage` path (same `/copilot/chat/stream`, same context/knowledge tiers/actions).
5. **Spoken reply** → when a response finishes streaming and `speakResponses` is on, the assistant
   text is spoken (markdown stripped to a plain, speakable string; "response 1 / update 1" style
   answers are read out).
6. Barge-in: starting to listen or send cancels any in-flight narration; closing the panel or
   unmounting stops mic + narration.

## 4. Panel integration

`copilot-panel.tsx` gains, only when `voice.enabled`:

- A **mic toggle** button in the header (and the greeting/listening/ speaking state as an aria-live
  status line). Reuses the existing cancel/close affordances.
- A small **"speak replies"** inline control (respects the admin default, user can mute locally).
- Spoken output is wired to the existing message-completion point (`onDone`), so streaming/among
  actions is unchanged for text users.

Nothing renders for users without the `copilot` module or when the admin switch is off, so the
default experience is identical to today.

## 5. Shared helpers + tests

`packages/shared/src/copilot-voice.ts` (pure, unit-tested with `node --test`, added to the shared
`test` script):

- `normalizeCopilotVoiceSettings` / `applyCopilotVoiceSettingsUpdate` — defaults merge + clamps
  (`listenSilenceMs` 1000–8000, `speechRate` 0.5–2, wake-word list bounded and lower-cased).
- `matchesWakeWord(transcript, wakeWords)` → `{ matched, command }`.
- `renderVoiceGreeting(template, name)` — safe `{name}` substitution with a sensible fallback.
- `stripMarkdownForSpeech(text)` — turn a chat reply into a clean spoken string.

## 6. Files touched

- **shared**: `copilot-voice.ts` (+ `copilot-voice.test.ts`), `index.ts` export.
- **db**: `schema.prisma` (`CopilotVoiceSetting`) + a new migration.
- **api**: `copilot.service.ts` (get/update voice settings via Prisma), `copilot.controller.ts`
  (two routes), `copilot.module.ts` unchanged.
- **web**: 4 hooks above; `copilot-panel.tsx`; `modules/admin/copilot-voice/*`;
  `app/(app)/admin/copilot-voice/{page,loading}.tsx`; `lib/app-nav.ts` (nav item).

## 7. Risks / notes

- **Browser support**: `SpeechRecognition` is Chromium/Edge/Safari; unsupported browsers simply do
  not show the mic (feature-detected). TTS is broadly supported. HTTPS + a user gesture (the toggle
  click) are required for the mic, which the toggle satisfies.
- **Privacy**: the mic only runs after an explicit toggle and always auto-stops after the silence
  window; the admin switch is the master gate. No always-on listening.
- **No new backend cost**: recognition and synthesis run in the browser; the server only stores the
  admin flags and answers chat exactly as it does now.
- **Accuracy**: wake-word matching is tolerant (normalised, punctuation-insensitive) but local; it is
  a convenience trigger, not a security control.
