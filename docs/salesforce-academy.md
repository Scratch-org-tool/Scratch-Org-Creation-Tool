# Salesforce Academy (Learning Module)

An admin-controlled, AI-powered training program built into the platform. It takes a complete
fresher to architect-level understanding through eight guided paths — the Salesforce core
curriculum plus programming (JavaScript, Java) and delivery (release management) tracks — with an
AI mentor on every lesson, an instant quiz after every module, and full progress visibility for
administrators.

## What learners get

- **Eight learning paths in three catalog groups** (25 modules, 75 lessons, ~71 hours of
  curriculum):

  *Salesforce core curriculum*
  1. **Salesforce Foundations** (Beginner) — CRM concepts, the platform, navigation, data model,
     reports, collaboration. Designed so a new joiner needs zero prior knowledge.
  2. **Admin & Configuration Mastery** (Intermediate) — the security model (profiles, permission
     sets, OWD, sharing), Flow automation, validation/formulas, data loading, sandboxes and releases.
  3. **Modern Salesforce Platform** (Intermediate) — Customer 360 cloud selection, OmniStudio,
     Data Cloud, Flow Orchestration, Agentforce, trusted AI, and production operations.
  4. **Platform Developer Track** (Advanced) — Apex, SOQL/SOSL, triggers, governor limits, testing,
     async Apex, Lightning Web Components, APIs and integration patterns.
  5. **Architect & DevOps Mastery** (Expert) — large data volumes, enterprise sharing, integration
     and identity architecture, Salesforce DX, scratch orgs, packaging, CI/CD, and governance.

  *Programming & platform skills*
  6. **JavaScript Mastery** (Intermediate) — language fundamentals, modern ES6+ syntax, async
     programming with promises/await, the DOM and events, fetch + REST APIs, and the exact
     patterns Lightning Web Components are built on. Full code samples in every module.
  7. **Java Programming** (Intermediate) — the JVM platform, types and control flow, OO design
     with interfaces and collections/generics/streams, exceptions, HTTP + JSON against the
     Salesforce REST API, and Maven/JUnit builds — the language of the middleware next to
     every org (and the one Apex grew from).

  *Delivery & release management*
  8. **Release Management & DevOps** (Advanced) — branching and environment strategy, release
     cadence/calendars/freeze windows, CI/CD quality gates with validate-only deploys, test
     strategy and static analysis, deployment/rollback mechanics, release planning with
     approvals and notes, go-live runbooks and hypercare, and DORA release-health metrics —
     mapped onto this platform's Releases, Drift, and Calendar modules.
- **Every lesson** includes learning objectives, structured explanations, a **real-world
  scenario → solution → outcome** case study, code samples where relevant, key takeaways, and
  **official Trailhead / Salesforce Developers / Architect resource links**.
- **AI Mentor** — a two-mode studio on every lesson page, grounded in that lesson's content:
  - **Story mode (generated visuals + directed voice)** — NVIDIA scripts a five-scene,
    concept-first learning film: curiosity hook → mental model → cause/effect → boundary or
    misconception → memorable compression. A learner can play the lesson, apply it to the curated
    case, or turn any lesson-grounded question into a narrated visual answer. When the self-hosted
    **open-source media stack** is configured (see `docs/academy-open-media-plan.md`), each scene
    gets a generated **motion clip** (ComfyUI + LTX-Video / Wan 2.2), or premium 16:9 still art
    (FLUX.1-schnell / SDXL), plus natural narration from **Microsoft VibeVoice** with six
    selectable narrators. The player adds cinematic motion, concept overlays, optional captions,
    speed controls, and scene navigation. Each media tier falls back independently — motion clip →
    still art → animated diagrams, and VibeVoice → device voices → timed captions — so one
    provider outage never breaks the story.
  - **Chat mode** — the classic Q&A tutor with real-world examples and follow-up suggestions;
    every reply has a "Listen" button for voice playback.
  Story scripts use the same NVIDIA integration as the platform copilot; all generated media comes
  from self-hosted open-source engines (no per-request vendor cost, nothing leaves your network).
  Storyboards fall back to a question-aware, lesson-derived script when NVIDIA is unavailable.
- **Video sessions** — every lesson page has a `Read | Video session` switch. The video session
  block shows real training videos that an **administrator uploads for that lesson** (MP4, WebM,
  OGG, MOV, MKV, AVI). The block is watch-only: learners play the videos inline with the standard
  player (seek, volume, fullscreen) and get no upload or delete controls. Playback is
  authenticated, so videos are only reachable by users with Academy access (and, for assigned-only
  learners, only for paths assigned to them). Admins manage the videos from **Academy Progress →
  Lesson video sessions** (`/learning/team`): pick path → module → lesson, upload, and delete;
  files are stored on the API server under `LEARNING_VIDEO_DIR` with metadata in Postgres, and the
  streaming endpoint supports HTTP Range requests. Production scripts for recording these videos
  live in `docs/training/` (see below).
- **Module quizzes with instant scoring** — 8 questions per module, generated fresh by the LLM
  (with a 220-question curated bank as automatic fallback when AI is unavailable). Scoring happens
  **server-side** (answers never reach the browser before submission), results are instant, and
  every question gets an explanation plus a coaching summary of focus areas. Pass mark: 70%.
- **Progress capture** — every lesson completion and quiz attempt (score, pass/fail, source,
  timestamps) is persisted. Module completion = all lessons read + quiz passed; path completion
  earns a named badge.
- **Production docs for every lesson** — `docs/training/` holds one generated document per path
  with, for every lesson: the full concept explanation, the real-world example, key takeaways,
  resources, and a timecoded **5-minute video script** (word-for-word narration, on-screen
  direction, demo steps) ready for recording or external AI video tools. Regenerate with
  `npm run docs:training` whenever curriculum changes.

## What admins get

- **Module gating** — `learning` is a locked module: standard users see the Academy only when an
  administrator grants it (Admin → User Access), exactly like other locked modules.
- **Catalog scope per user** — in User Access → Manage, admins can flip a learner to
  **assigned paths only**. The catalog, lessons, quizzes, AI mentor, stories, and uploaded video
  sessions (list + stream) of unassigned paths are then completely invisible to that user
  (enforced server-side with 403s, not just hidden in the UI) until an admin assigns the path.
  Stats and progress totals reflect only the visible curriculum.
- **Assignments** — from **Academy Progress** (`/learning/team`), admins assign one or more paths
  to one or more users with an optional note and due date. Academy access must first be explicitly
  enabled in **Admin → User Access**; assignments never bypass that control. Assigned learners
  receive an in-app notification (email follows the platform's notification settings).
- **Team progress dashboard** — per-learner rows with lessons completed, quizzes passed, average
  score, last activity, and per-path progress bars; team totals (active learners, assignments,
  average score). Assignments can be revoked; progress is never deleted.
- **Lesson video management** — the same Academy Progress page hosts the **Lesson video sessions**
  panel: pick path → module → lesson, upload recorded training videos, and delete outdated ones.
  Learners only ever see the resulting watch-only playback on the lesson page.
- **Completion notifications** — when a learner completes an assigned path, the assigning admin
  is notified.

## Where things live

| Layer | Location |
|-------|----------|
| Shared contracts | `packages/shared/src/learning.ts` (types, Zod schemas, progress math) |
| DB models | `LearningAssignment`, `LearningLessonProgress`, `LearningLessonVideo`, `LearningQuizAttempt` in `packages/db/prisma/schema.prisma` |
| Curriculum content | `apps/api/src/modules/learning/curriculum/*.path.ts` (versioned in code) |
| API module | `apps/api/src/modules/learning/` (NestJS) |
| Web workspaces | `apps/web/src/modules/learning/` + routes under `apps/web/src/app/(app)/learning/` |

The curriculum is **code, not database content**: updating a lesson is a normal PR with review and
history, and per-user progress (stored by stable lesson/module ids) survives content edits.

## API surface

All routes require authentication and the `learning` module (admins always have it).

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/learning/catalog` | Paths + per-user progress + stats + "continue learning" target |
| GET | `/api/learning/paths/:pathId` | One path with per-lesson/quiz status |
| GET | `/api/learning/lessons/:lessonId` | Full lesson content + prev/next navigation |
| POST | `/api/learning/lessons/:lessonId/complete` | Idempotent lesson completion |
| GET | `/api/learning/lessons/:lessonId/videos` | Admin-uploaded video sessions for a lesson |
| GET | `/api/learning/videos/:videoId/stream` | Stream an uploaded video (HTTP Range supported) |
| POST | `/api/learning/admin/lessons/:lessonId/videos` | Admin: upload a video (multipart `file` + optional `title`) |
| DELETE | `/api/learning/admin/videos/:videoId` | Admin: delete an uploaded video (file + metadata) |
| POST | `/api/learning/modules/:moduleId/quiz` | Start (or resume) a quiz attempt |
| GET | `/api/learning/modules/:moduleId/attempts` | The user's attempt history for a module |
| POST | `/api/learning/quiz/:attemptId/submit` | Score an attempt server-side; returns full review |
| POST | `/api/learning/tutor` | Ask the AI mentor (lesson-grounded) |
| POST | `/api/learning/tutor/explainer` | Concept-first storyboard (`{lessonId, focus?, question?}`) + live media capabilities (`media.status` per tier: `ready` / `unreachable` / `off`) |
| POST | `/api/learning/tutor/explainer/video` | Generate/cache one scene motion clip (`{...storyRequest, sceneId}`); 204 activates still-art fallback |
| POST | `/api/learning/tutor/explainer/image` | Generate/cache one scene image (`{...storyRequest, sceneId}`); 204 activates diagram fallback |
| POST | `/api/learning/tutor/explainer/speech` | Generate/cache one scene narration (`{...storyRequest, sceneId, voice}`); 204 activates browser voice |
| GET | `/api/learning/admin/overview` | Admin: team progress report |
| GET | `/api/learning/admin/learners/:userId` | Admin: one learner's full path breakdown |
| POST | `/api/learning/admin/assignments` | Admin: assign paths to users (`{userIds, pathIds, note?, dueAt?}`) |
| DELETE | `/api/learning/admin/assignments/:id` | Admin: revoke an assignment |

## Quiz integrity model

1. `POST /modules/:id/quiz` generates questions (AI first, curated bank as fallback; `source` is
   `ai`, `static`, or `mixed`) and stores them — **including** correct answers and explanations —
   in the `LearningQuizAttempt` row. The response contains questions **without** answers.
2. An in-progress attempt is resumed rather than regenerated, so refreshing the page cannot be
   used to fish for an easier question set.
3. `POST /quiz/:attemptId/submit` scores against the stored answer key, marks the attempt
   `completed` (double submission is rejected), and returns the full review with explanations and
   a coaching summary. Passing requires ≥ 70%. Retakes create new attempts; the best score counts
   toward module completion and all attempts remain in the history.

## AI configuration

The Academy uses NVIDIA NIM for grounded writing and an optional **self-hosted open-source media
stack** for generated narration, scene art, and motion clips. Model choices, deployment recipes,
GPU sizing, and the phased rollout live in `docs/academy-open-media-plan.md`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `LEARNING_QUIZ_AI_TIMEOUT_MS` | `25000` | Budget for AI quiz generation before static fallback |
| `LEARNING_TUTOR_TIMEOUT_MS` | `30000` | Budget for AI mentor answers |
| `LEARNING_EXPLAINER_TIMEOUT_MS` | `30000` | Budget for AI storyboard scripting before static fallback |
| `LEARNING_VIDEO_DIR` | `<api cwd>/uploads/learning-videos` | Where admin-uploaded lesson videos are stored on disk |
| `LEARNING_VIDEO_MAX_MB` | `1024` | Maximum upload size per video file |
| `VIBEVOICE_SPACE_URL` | — | Hosted VibeVoice Gradio Space for narration (preferred when set); `VIBEVOICE_SPACE_API` (`/generate_podcast_wrapper`), `VIBEVOICE_CFG_SCALE` (1.3), `HF_SPEECH_TIMEOUT_MS` (300 s) |
| `ZIMAGE_SPACE_URL` | — | Hosted Z-Image-Turbo Gradio Space for scene art (preferred when set); `ZIMAGE_SPACE_API` (`/generate_image`), `ZIMAGE_STEPS` (9), `HF_IMAGE_TIMEOUT_MS` (120 s) |
| `WAN_VIDEO_SPACE_URL` | — | Hosted Wan 2.2 image-to-video Gradio Space (preferred when set; animates the scene still, so the image tier must be on); `WAN_VIDEO_SPACE_API` (`/generate_video`), `WAN_VIDEO_STEPS` (4), `WAN_VIDEO_DURATION_SECONDS` (2.5), `HF_VIDEO_TIMEOUT_MS` (480 s) |
| `HF_TOKEN` | — | Hugging Face token sent to all Spaces — effectively required for voice/video ZeroGPU quota |
| `VIBEVOICE_BASE_URL` | — | Self-hosted VibeVoice server (OpenAI-compatible `POST /v1/audio/speech`); `VIBEVOICE_API_KEY`, `VIBEVOICE_MODEL`, `VIBEVOICE_TIMEOUT_MS` (60 s), `VIBEVOICE_ENABLED` |
| `SD_WEBUI_BASE_URL` | — | Self-hosted Stable-Diffusion-WebUI-compatible image API (`POST /sdapi/v1/txt2img`); `SD_IMAGE_MODEL`, `SD_IMAGE_STEPS` (20; FLUX-schnell: 4), `SD_IMAGE_CFG_SCALE` (7; FLUX: 1), `SD_IMAGE_SAMPLER`, `SD_IMAGE_WIDTH/HEIGHT` (1280×720), `SD_IMAGE_TIMEOUT_MS` (60 s), `SD_IMAGE_ENABLED` |
| `COMFYUI_BASE_URL` | — | Self-hosted ComfyUI for motion clips; `COMFYUI_VIDEO_WORKFLOW` (template path; built-in LTX-Video default), `COMFYUI_VIDEO_CHECKPOINT`, `COMFYUI_TEXT_ENCODER`, `COMFYUI_VIDEO_WIDTH/HEIGHT/FRAMES/FPS` (768×512, 97 f, 24 fps), `COMFYUI_VIDEO_TIMEOUT_MS` (180 s), `COMFYUI_VIDEO_ENABLED` |

Without a valid NVIDIA key, quizzes serve the curated bank and stories use the deterministic
lesson-derived script. Without any media server, stories keep their animated concept diagrams
(icons and colors derived per lesson topic, so different concepts look different) and let learners
choose among voices installed by their browser/operating system. The API live-probes each
configured media server (60-second cache) and reports `media.status` per tier; the player surfaces
"Media studio unreachable" / "Built-in visuals · device voice" so a broken setup is visible instead
of a silent fallback. See the troubleshooting table in `docs/academy-open-media-plan.md`.

### Visual story pipeline

1. `POST /learning/tutor/explainer` gives NVIDIA the full lesson grounding and requests a strict
   JSON storyboard. Every scene contains spoken-only narration, delivery direction, cinematic
   visual direction, and a safe diagram spec (`flow | compare | stack | timeline | callout | grid`).
   Concept stories do not force a generic business example; the separate case-story action does.
2. `sanitizeStoryboard` (`@sfcc/shared`) clamps all generated text and whitelists deliveries,
   icons, accents, and visual kinds. Thin/malformed output is replaced with a deterministic
   concept arc. A custom question is preserved in this fallback instead of silently replaying the
   generic lesson.
3. The browser requests only the active scene's media. The API composes diffusion-style prompts
   (subject + style + strict negative prompt) from the trusted storyboard, calls the self-hosted
   engines server-side, validates media types/sizes, and caches successful output for six hours
   with in-flight deduplication. It preloads the next scene's media after the active one.
4. Media degrades tier by tier: motion clip → still art → the animated diagram already under the
   scene. VibeVoice failure switches to the selected local `SpeechSynthesis` voice; if speech is
   unavailable, captions and reading-time auto-advance remain functional.
5. The player never asks generated media to reproduce Salesforce UI or render explanatory text.
   Accurate labels stay in application-owned overlays, and the lesson remains the source of truth.
6. Only VibeVoice's stock demo narrators are exposed; learner-supplied reference audio (voice
   cloning) is deliberately not part of the API surface.

## Web routes

| Route | Page |
|-------|------|
| `/learning` | Academy home: hero + overall progress, KPIs, assigned training, path catalog |
| `/learning/paths/[pathId]` | Path detail: module timeline, lesson checklists, quiz status |
| `/learning/lessons/[lessonId]` | Lesson: content, real-world example, resources, AI mentor panel |
| `/learning/modules/[moduleId]/quiz` | Quiz: question stepper → instant results + answer review |
| `/learning/team` | Admin: team progress + assignment management |
