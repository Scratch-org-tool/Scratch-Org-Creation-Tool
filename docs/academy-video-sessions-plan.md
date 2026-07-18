# Academy Video Sessions — Analysis & Plan

The request: every Salesforce topic in the Academy needs a **video session** — a complete,
in-depth, end-to-end production script (not just concept talk: also *how to create, how to
execute*, step by step) shown in its own block on the lesson page, exportable so videos can be
produced with external AI video tools (HeyGen, Synthesia, InVideo, CapCut, Runway…), and playable
in-app where possible.

## 1. Analysis of the current lesson page

| Block today | Keep / change |
|-------------|---------------|
| Reading column (objectives, sections, code, real-world case, takeaways, resources) | **Keep, but demote to one of two views.** Removing it entirely would break the read-then-quiz learning loop and admin progress semantics, so instead the lesson column gets a first-class switch: **“Video session”** (new, default-equal) alongside **“Read”**. |
| Right rail — AI Mentor (story + chat) | Keep. The video session reuses its player for instant in-app animated playback. |

## 2. What a Video Session is

One **production-ready script per lesson** (66 lessons × 8 paths — every topic in the platform),
structured the way video tools expect:

- **Segments with timecodes**, each one of: `intro` (hook + what you'll build/learn), `concept`
  (the idea taught through the running story), `demo` (**exact click-path walkthrough**: Setup →
  Object Manager → …, what to type, what to verify — the "how to create / how to execute" part),
  `story` (the lesson's real-world case: tension → turning point → payoff), `recap` (compress to
  memory), `cta` (take the module quiz / next lesson).
- Per segment: **word-for-word narration** (written for the ear), **on-screen / animation
  direction** (what the video shows while the narration plays), optional **lower-third caption**,
  and **numbered demo steps** for screen-capture segments.
- Header metadata: audience level, target duration, segment count, generation source.

## 3. How scripts are produced (same resilience pattern as the rest of the Academy)

1. **AI-first**: NVIDIA writes the script as strict JSON from the full lesson grounding
   (sections, code samples, real-world case, objectives, takeaways), with explicit rules to
   include hands-on demo segments with real click-paths and to keep one continuous storyline.
2. **Sanitized**: every field is length-clamped and kind-whitelisted in `@sfcc/shared`
   (`sanitizeVideoScript`) before it is served — malformed AI output can never reach the UI.
3. **Deterministic fallback**: when AI is unavailable, the script is assembled from the
   curriculum itself (objectives → intro; each section → concept segment, with bullet lists
   becoming numbered demo steps; real-world case → story segment; takeaways → recap; quiz → cta).
   Every lesson always has a complete script.
4. Cached in-process for six hours per lesson (same policy as storyboards).

## 4. Turning scripts into actual videos

- **In-app now**: “Play animated session” launches the existing story player — VibeVoice
  narration + generated scene art / motion clips from the open-source media stack.
- **External tools now**: per-lesson exports — **Copy full script**, **Download production
  script (.md)** (segments, timecodes, directions, demo steps), **Download narration only
  (.txt)** (paste straight into HeyGen / Synthesia / any TTS-avatar tool; scene directions go to
  the storyboard/timeline side of those tools).
- **Later (phase 2, optional)**: server-side MP4 rendering — compose the per-scene generated
  stills/clips + VibeVoice audio with ffmpeg into a downloadable video, then attach it to the
  lesson. The script contract built here is the input format for that job.

## 5. API & UI surface added

| Piece | Detail |
|-------|--------|
| `GET /api/learning/lessons/:lessonId/video-script` | Auth + `learning` module; returns the sanitized script JSON |
| Lesson page | `Read \| Video session` segmented switch; the video block shows the scripted session with per-segment listen, timecodes, demo steps, and export actions |
| Shared | `LessonVideoScript` contracts, sanitizer, `videoScriptToMarkdown`, `videoScriptToNarration`, duration estimation |

## 6. Risks / notes

- Script quality without NVIDIA falls back to curriculum-derived scripts — correct and complete,
  less cinematic. Configure `NVIDIA_API_KEY` for the storyline treatment.
- Demo click-paths come from lesson content; the AI is instructed never to invent UI that the
  grounding doesn't support.
- Reading remains available — the quiz gate (“all lessons read”) is unchanged; watching a video
  session and pressing *Mark complete* counts identically to reading.
