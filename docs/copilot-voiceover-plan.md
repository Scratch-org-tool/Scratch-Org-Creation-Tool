# AI Copilot Voiceover Plan

Plan for adding **voice input** (listen / wake phrase) and **voice output** (spoken replies)
to the AI Copilot, behind an **admin master switch** that is off by default.

Today the copilot is typing-only (`CopilotPanel` → `POST /copilot/chat/stream`). Academy already
has browser TTS (`use-speech.ts`) and optional studio TTS. There is **no** microphone input,
wake-word detection, or spoken copilot replies yet. The web app also blocks the mic via
`Permissions-Policy: microphone=()` in `apps/web/src/middleware.ts`.

---

## 1. Goals

1. **Push-to-listen toggle** — user clicks a mic/voice toggle on the copilot; listening starts.
2. **Short idle timeout** — if nothing useful is heard for ~2–3 seconds, listening stops (toggle off).
3. **Spoken answers** — when voice mode is on (or the turn came from voice), the assistant reply
   is read aloud after (or while) it streams in.
4. **Wake greeting** — phrases like “Hey co-pilot” / “Hey assistant” trigger a short spoken
   greeting that uses the user’s `displayName` (already on `UserAccessProfile` / `/auth/me`).
5. **Admin-controlled** — feature is inert until an admin enables it. Same spirit as
   notification settings: master switch off by default; no mic UI, no listening, no TTS from
   the copilot while disabled.
6. **Non-breaking** — typing chat keeps working unchanged; voice is additive.

Non-goals for the first ship:

- Always-on ambient listening across the whole app (only while the user-enabled toggle is on).
- Server-side wake-word engines (Porcupine, etc.) — start with browser speech recognition.
- Studio-quality Qwen/VibeVoice for every copilot turn (optional later; browser TTS first).

---

## 2. User experience

### 2.1 Preconditions

Voice controls appear only when **all** of the following are true:

| Gate | Source |
|------|--------|
| User can access Copilot | `canAccessModule(profile, 'copilot')` (existing module grant) |
| Admin enabled voice | New `CopilotVoiceSettings.enabled === true` |
| Browser supports STT and/or TTS | `SpeechRecognition` / `speechSynthesis` capability checks |

If the admin switch is off, the mic toggle and auto-speak behavior are absent (or disabled with
a clear “Voice disabled by admin” tooltip for admins testing).

### 2.2 Modes

```
[ Off ] ──click──> [ Listening ] ──idle 2–3s / cancel──> [ Off ]
                      │
                      ├── wake phrase only → greet by name (spoken) → stay Listening or brief pause
                      └── real question   → send to copilot stream → speak reply → Listening again
```

**Toggle on (Listening)**

1. Request microphone permission (first time).
2. Start continuous / interim recognition in the background while the panel (or a compact
   voice indicator) is active.
3. Show a clear listening state (pulsing mic, “Listening…”, elapsed silence meter).

**Silence / irrelevance timeout (2–3 s)**

- Track time since last **meaningful** transcript fragment.
- “Meaningful” = non-empty speech that is not only filler (`um`, `uh`) and preferably
  matches a wake phrase **or** looks like a command/question once the session is armed.
- After 2–3 seconds with no meaningful speech → stop recognition, set toggle off, optional
  soft spoken cue (“I’ll stop listening”) only if admin setting allows feedback sounds.

**Wake phrase**

- Match (case-insensitive, fuzzy): `hey co-pilot`, `hey copilot`, `hey assistant`,
  `ok co-pilot`, etc. Configurable list in shared constants.
- On match: speak greeting using `displayName`, e.g.  
  `Hi {displayName}, I'm your co-pilot. How can I help?`  
  Fallback if name missing: `Hi there, I'm your co-pilot. How can I help?`
- Name comes from `useAuth().profile.displayName` (same as sidebar:
  `profile?.displayName ?? user?.displayName ?? email local-part`). Server already merges
  `displayName` into copilot context in `CopilotService.mergeContext`.

**Question after wake (or direct voice question while listening)**

- Buffer transcript until a short end-of-utterance pause (e.g. 800–1200 ms) or final STT result.
- Submit via existing `sendMessage(transcript)` path (same NDJSON stream).
- When the assistant message completes (or after enough content), speak it with TTS.
- Prefer speaking a **cleaned** version of the reply (strip markdown noise: code fences,
  excessive links) so voiceover stays natural.

**Typing still works**

- Text input unchanged.
- Optional: if voice toggle is on and the user types a message, still speak the reply
  (controlled by a sub-setting `speakTypedReplies`, default false — only speak voice-originated
  turns in v1 to avoid surprising users).

---

## 3. Admin control (master switch)

Mirror the **notifications** pattern (`NotificationSettings.enabled` off by default).

### 3.1 Settings shape (`@sfcc/shared`)

```ts
export interface CopilotVoiceSettings {
  /** Master switch. When false, no client may activate mic listen or copilot TTS. */
  enabled: boolean;
  /** Seconds of silence before auto-stopping listen (default 2.5). */
  idleTimeoutSeconds: number;
  /** Wake phrases, lowercase. */
  wakePhrases: string[];
  /** Greeting template; `{name}` replaced with displayName. */
  greetingTemplate: string;
  updatedAt?: string;
  updatedBy?: string | null;
}

export const DEFAULT_COPILOT_VOICE_SETTINGS: CopilotVoiceSettings = {
  enabled: false,
  idleTimeoutSeconds: 2.5,
  wakePhrases: ['hey co-pilot', 'hey copilot', 'hey assistant'],
  greetingTemplate: "Hi {name}, I'm your co-pilot. How can I help?",
};
```

### 3.2 API

- `GET /admin/copilot-voice/settings` — admin read
- `PUT /admin/copilot-voice/settings` — admin update (zod-validated)
- `GET /copilot/voice/settings` — **authenticated + copilot module**; returns a **public subset**
  (`enabled`, `idleTimeoutSeconds`, `wakePhrases`, `greetingTemplate`) so the client can gate UI
  without granting admin APIs

Persist like notification settings (Firestore / existing admin config store — follow the same
service used by notification settings for consistency).

### 3.3 Admin UI

New card under Admin (near Notifications), e.g. **Admin → AI Copilot Voice**:

- Master toggle: “Enable copilot voice”
- Idle timeout (number input, 2–3 s recommended range)
- Optional advanced: wake phrases, greeting template
- Copy: “When off, users only see the existing text chat. Microphone listening and spoken
  replies stay inactive.”

### 3.4 Client enforcement

Even if someone tampers with the UI:

1. Client only mounts voice hooks when `publicSettings.enabled`.
2. Optional hardening: API rejects a `voice: true` flag on chat if settings are disabled
   (not required for v1 if voice is purely client-side STT/TTS around the existing chat API).

---

## 4. Architecture

```
Admin enables CopilotVoiceSettings.enabled
        │
User with copilot module opens CopilotPanel
        │
        ├── [Mic toggle] ──> useCopilotVoiceListen (Web Speech STT)
        │                      ├── idle 2–3s → stop
        │                      ├── wake phrase → speak greeting (displayName)
        │                      └── utterance → sendMessage() → stream → speak reply
        │
        └── [Existing textarea] → sendMessage() → stream  (unchanged)

TTS: reuse / extract apps/web/src/modules/learning/use-speech.ts
     (browser speechSynthesis). Later optional: Academy studio speech endpoint.
```

### 4.1 Prerequisite: microphone permission policy

`apps/web/src/middleware.ts` currently sets `microphone=()`. That **must** change to allow
the app origin to use the mic when voice is enabled (e.g. `microphone=(self)`), or voice
input cannot work in Chromium.

Document that browsers still prompt the user; the admin switch does not bypass the OS/browser
permission dialog.

### 4.2 New / touched frontend pieces

| Piece | Role |
|-------|------|
| `hooks/use-copilot-voice-settings.ts` | Fetch public settings; cache |
| `hooks/use-copilot-voice-listen.ts` | STT, idle timer, wake match, transcript finalize |
| `hooks/use-copilot-voice-speak.ts` | Thin wrapper over shared speech controller + markdown strip |
| Extract `use-speech` → shared location (e.g. `hooks/use-speech.ts`) | Avoid Academy-only coupling |
| `copilot-panel.tsx` | Mic toggle, listening indicator, wire listen → `sendMessage`, speak on done |
| Zustand store (optional) | `voiceListening`, `voiceArmed`, last transcript |

### 4.3 Backend pieces

| Piece | Role |
|-------|------|
| Shared schemas + defaults | `@sfcc/shared` |
| Admin settings service/controller | Persist + CRUD |
| Public settings endpoint under copilot | Enabled flag for clients |
| Prompt tweak (small) | Instruct model that voice turns prefer concise spoken-friendly answers when `context.inputModality === 'voice'` |

### 4.4 Greeting (“response 1 / update 1”)

Treat greeting as a **local, deterministic** first response (no LLM round-trip):

1. Detect wake phrase in STT.
2. Build greeting string from template + `displayName`.
3. Optionally append a system/user-visible assistant bubble in the transcript so the chat
   history shows the greeting (recommended for consistency).
4. Speak it immediately via TTS.

Follow-up questions use the normal copilot stream (spoken when voice mode originated the turn).

---

## 5. Implementation phases

### Phase A — Admin gate + plumbing (no mic UX yet)

1. Shared `CopilotVoiceSettings` + defaults + normalize helpers + tests.
2. Persist + admin GET/PUT + public GET.
3. Admin UI master toggle (off by default).
4. Relax `Permissions-Policy` microphone for self (coordinate with security review).

### Phase B — Voice output (TTS)

1. Extract/reuse `use-speech` for copilot.
2. “Speak reply” after voice-originated (and optionally all) assistant messages complete.
3. Markdown → speakable plain text helper + unit tests.
4. Stop speaking when user cancels stream, closes panel, or starts a new listen.

### Phase C — Voice input (STT + idle timeout)

1. Mic toggle on `CopilotPanel`.
2. `SpeechRecognition` wrapper with interim results + final utterance assembly.
3. Idle timeout 2–3 s → auto off.
4. Permission denied / unsupported browser messaging.

### Phase D — Wake phrase + named greeting

1. Wake phrase matcher against admin (or default) list.
2. Greeting with `displayName`; show + speak.
3. Arm listening for the follow-up question without requiring a second toggle click.

### Phase E — Polish (optional)

1. Studio TTS fallback (Academy speech service) for higher quality.
2. Per-user “prefer voice replies” preference (still requires admin master on).
3. Analytics: voice sessions started, wake hits, idle auto-stops (privacy-safe counts).

---

## 6. Edge cases and risks

| Risk | Mitigation |
|------|------------|
| Mic policy blocks STT | Change `Permissions-Policy`; verify in Chrome/Edge/Safari |
| Safari / Firefox STT gaps | Feature-detect; hide mic or show “Voice input not supported” |
| Accidental ambient pickup | Short idle timeout; no always-on without toggle; clear listening UI |
| Long markdown replies sound bad | Strip/simplify before speak; prompt for shorter voice answers |
| Admin off but cached client settings | Short TTL / refetch on panel open; default deny |
| Privacy / workplace norms | Admin off by default; no recording upload — STT stays in-browser for v1 |
| Concurrent Academy + Copilot TTS | Share one speech controller or cancel-on-focus so voices don’t overlap |

---

## 7. Testing plan

- Unit: wake phrase matcher, greeting template + missing name, idle timer, markdown strip,
  settings normalize (enabled false by default).
- Component: mic toggle hidden when settings disabled; visible when enabled + copilot grant.
- Manual: enable admin switch → grant mic → wake phrase greets by name → ask module question →
  hear reply → stay silent 3 s → listening stops.
- Regression: typed chat with voice admin **off** behaves exactly as today.

---

## 8. Success criteria

1. With admin voice **disabled**, no mic toggle and no copilot auto-TTS.
2. With admin voice **enabled**, toggle starts listening; 2–3 s idle stops it.
3. “Hey co-pilot / hey assistant” greets the signed-in user’s display name aloud.
4. Voice questions about the app get streamed answers that are also spoken.
5. Text chat remains fully usable in all cases.

---

## 9. Open decisions (confirm before build)

1. **Idle timeout default**: 2.0 vs 2.5 vs 3.0 seconds?
2. **Speak typed replies** in v1, or only voice-originated turns?
3. **Always reopen listen** after a spoken answer, or leave toggle off until the user clicks again?
4. **Admin UI placement**: standalone Admin page vs card on Notifications / User Access?
5. **Studio TTS** in v1 or browser-only first?

Recommended defaults for v1: **2.5 s idle**, **speak voice-originated only**, **resume listening
after answer while toggle was on**, **standalone Admin → Copilot Voice card**, **browser TTS first**.
