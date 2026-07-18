# Salesforce Academy (Learning Module)

An admin-controlled, AI-powered Salesforce and engineering training program built into the
platform. It takes a complete fresher to architect-level understanding through eight guided paths,
with an AI mentor on every lesson, an instant quiz after every module, and full progress visibility
for administrators.

## What learners get

- **Eight learning paths, beginner → expert** (25 modules, 66 lessons, ~84 hours of curriculum):
  1. **Salesforce Foundations** (Beginner) — CRM concepts, the platform, navigation, data model,
     reports, collaboration. Designed so a new joiner needs zero prior knowledge.
  2. **JavaScript Engineering** (Beginner) — modern JavaScript and TypeScript, async APIs,
     browser accessibility and security, Jest, and production-quality Lightning Web Components.
  3. **Admin & Configuration Mastery** (Intermediate) — the security model (profiles, permission
     sets, OWD, sharing), Flow automation, validation/formulas, data loading, sandboxes and releases.
  4. **Modern Salesforce Platform** (Intermediate) — Customer 360 cloud selection, OmniStudio,
     Data Cloud, Flow Orchestration, Agentforce, trusted AI, and production operations.
  5. **Platform Developer Track** (Advanced) — Apex, SOQL/SOSL, triggers, governor limits, testing,
     async Apex, Lightning Web Components, APIs and integration patterns.
  6. **Java Integration Engineering** (Advanced) — modern Java, build/test tooling, Spring Boot,
     OAuth, Salesforce APIs, resilient integration, and observability.
  7. **Salesforce Release Management** (Advanced) — Git and release trains, metadata and packages,
     environments, CI/CD gates, runbooks, recovery, hotfixes, and delivery improvement.
  8. **Architect & DevOps Mastery** (Expert) — large data volumes, enterprise sharing, integration
     and identity architecture, Salesforce DX, scratch orgs, packaging, CI/CD, and governance.
  The ~84-hour estimate includes lesson study, demonstrations, hands-on practice, mentor work,
  quizzes, and review—not only the authored reading time.
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
- **Video production and sessions** — the current lesson page has a `Read | Video session` switch
  backed by an AI-generated, curriculum-derived production script with a deterministic fallback.
  The 24 new lessons also have reviewed, time-coded five-minute narration and editor directions in
  `docs/salesforce-academy-expanded-training-video-scripts.md`. Those scripts are production
  inputs for the parallel admin-upload workflow: upload and deletion stay admin-only, playback
  requires the learner's explicit `learning` grant, and the stable lesson ID is the asset join key.
  Until that upload branch is merged, the existing script playback and export behavior remains the
  runtime implementation.
- **Module quizzes with instant scoring** — 8 questions per module, generated fresh by the LLM
  (with a 228-question curated bank as automatic fallback when AI is unavailable). Scoring happens
  **server-side** (answers never reach the browser before submission), results are instant, and
  every question gets an explanation plus a coaching summary of focus areas. Pass mark: 70%.
- **Progress capture** — every lesson completion and quiz attempt (score, pass/fail, source,
  timestamps) is persisted. Module completion = all lessons read + quiz passed; path completion
  earns a named badge.

## What admins get

- **Module gating** — `learning` is a locked module: standard users see the Academy only when an
  administrator grants it (Admin → User Access), exactly like other locked modules.
- **Assignments** — from **Academy Progress** (`/learning/team`), admins assign one or more paths
  to one or more users with an optional note and due date. Academy access must first be explicitly
  enabled in **Admin → User Access**; assignments never bypass that control. Assigned learners
  receive an in-app notification (email follows the platform's notification settings).
- **Team progress dashboard** — per-learner rows with lessons completed, quizzes passed, average
  score, last activity, and per-path progress bars; team totals (active learners, assignments,
  average score). Assignments can be revoked; progress is never deleted.
- **Completion notifications** — when a learner completes an assigned path, the assigning admin
  is notified.

## Where things live

| Layer | Location |
|-------|----------|
| Shared contracts | `packages/shared/src/learning.ts` (types, Zod schemas, progress math) |
| DB models | `LearningAssignment`, `LearningLessonProgress`, `LearningQuizAttempt` in `packages/db/prisma/schema.prisma` |
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
| GET | `/api/learning/lessons/:lessonId/video-script` | Complete end-to-end video session script (AI-first, curriculum fallback) |
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
