# Salesforce Academy (Learning Module)

An admin-controlled, AI-powered Salesforce training program built into the platform. It takes a
complete fresher to architect-level understanding through four guided paths, with an AI mentor on
every lesson, an instant quiz after every module, and full progress visibility for administrators.

## What learners get

- **Four learning paths, beginner → expert** (13 modules, 42 lessons, ~42 hours of curriculum):
  1. **Salesforce Foundations** (Beginner) — CRM concepts, the platform, navigation, data model,
     reports, collaboration. Designed so a new joiner needs zero prior knowledge.
  2. **Admin & Configuration Mastery** (Intermediate) — the security model (profiles, permission
     sets, OWD, sharing), Flow automation, validation/formulas, data loading, sandboxes and releases.
  3. **Platform Developer Track** (Advanced) — Apex, SOQL/SOSL, triggers, governor limits, testing,
     async Apex, Lightning Web Components, APIs and integration patterns.
  4. **Architect & DevOps Mastery** (Expert) — large data volumes, enterprise sharing, integration
     and identity architecture, Salesforce DX, scratch orgs, packaging, CI/CD, and governance.
- **Every lesson** includes learning objectives, structured explanations, a **real-world
  scenario → solution → outcome** case study, code samples where relevant, key takeaways, and
  **official Trailhead / Salesforce Developers / Architect resource links**.
- **AI Mentor** — a two-mode studio on every lesson page, grounded in that lesson's content:
  - **Story mode (generated visuals + directed voice)** — NVIDIA scripts a five-scene,
    concept-first learning film: curiosity hook → mental model → cause/effect → boundary or
    misconception → memorable compression. A learner can play the lesson, apply it to the curated
    case, or turn any lesson-grounded question into a narrated visual answer. When Google Gemini
    media is configured, each scene gets premium 16:9 concept art and natural generated narration
    with six selectable teaching voices. The player adds cinematic motion, concept overlays,
    optional captions, speed controls, and scene navigation. Generated media falls back
    independently to animated diagrams and the browser's installed voices, so one provider outage
    never breaks the story.
  - **Chat mode** — the classic Q&A tutor with real-world examples and follow-up suggestions;
    every reply has a "Listen" button for voice playback.
  Story scripts use the same NVIDIA integration as the platform copilot; generated scene media uses
  a separate server-side Google Gemini API key. Storyboards fall back to a question-aware,
  lesson-derived script when NVIDIA is unavailable.
- **Module quizzes with instant scoring** — 8 questions per module, generated fresh by the LLM
  (with a 130-question curated bank as automatic fallback when AI is unavailable). Scoring happens
  **server-side** (answers never reach the browser before submission), results are instant, and
  every question gets an explanation plus a coaching summary of focus areas. Pass mark: 70%.
- **Progress capture** — every lesson completion and quiz attempt (score, pass/fail, source,
  timestamps) is persisted. Module completion = all lessons read + quiz passed; path completion
  earns a named badge.

## What admins get

- **Module gating** — `learning` is a locked module: standard users see the Academy only when an
  administrator grants it (Admin → User Access), exactly like other locked modules.
- **Assignments** — from **Academy Progress** (`/learning/team`), admins assign one or more paths
  to one or more users with an optional note and due date. Assigning **automatically grants** the
  learning module to that user and sends them an in-app notification (email follows the platform's
  notification settings).
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
| POST | `/api/learning/modules/:moduleId/quiz` | Start (or resume) a quiz attempt |
| GET | `/api/learning/modules/:moduleId/attempts` | The user's attempt history for a module |
| POST | `/api/learning/quiz/:attemptId/submit` | Score an attempt server-side; returns full review |
| POST | `/api/learning/tutor` | Ask the AI mentor (lesson-grounded) |
| POST | `/api/learning/tutor/explainer` | Concept-first storyboard (`{lessonId, focus?, question?}`) + media capabilities |
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

The Academy uses NVIDIA NIM for grounded writing and optionally Google Gemini for generated image
and speech media. Google credentials stay on the API server. A Firebase web API key is an app
identifier and **must not** be treated as the Gemini server credential.

| Variable | Default | Purpose |
|----------|---------|---------|
| `LEARNING_QUIZ_AI_TIMEOUT_MS` | `25000` | Budget for AI quiz generation before static fallback |
| `LEARNING_TUTOR_TIMEOUT_MS` | `30000` | Budget for AI mentor answers |
| `LEARNING_EXPLAINER_TIMEOUT_MS` | `30000` | Budget for AI storyboard scripting before static fallback |
| `GOOGLE_GENAI_API_KEY` | — | Server-side Google AI Studio key; `GEMINI_API_KEY` and `GOOGLE_API_KEY` are accepted aliases |
| `GOOGLE_IMAGE_MODEL` | `gemini-3.1-flash-image` | Gemini model for 16:9 scene art |
| `GOOGLE_TTS_MODEL` | `gemini-3.1-flash-tts-preview` | Gemini model for selectable studio narration |
| `GOOGLE_MEDIA_TIMEOUT_MS` | `45000` | Per-scene image/speech generation budget |
| `GOOGLE_IMAGE_GENERATION_ENABLED` | `true` | Set `false` to force animated-diagram visuals |
| `GOOGLE_TTS_ENABLED` | `true` | Set `false` to force browser narration |

Without a valid NVIDIA key, quizzes serve the curated bank and stories use the deterministic
lesson-derived script. Without a Google key, stories keep their animated concept diagrams and let
learners choose among voices installed by their browser/operating system.

### Visual story pipeline

1. `POST /learning/tutor/explainer` gives NVIDIA the full lesson grounding and requests a strict
   JSON storyboard. Every scene contains spoken-only narration, delivery direction, cinematic
   visual direction, and a safe diagram spec (`flow | compare | stack | timeline | callout | grid`).
   Concept stories do not force a generic business example; the separate case-story action does.
2. `sanitizeStoryboard` (`@sfcc/shared`) clamps all generated text and whitelists deliveries,
   icons, accents, and visual kinds. Thin/malformed output is replaced with a deterministic
   concept arc. A custom question is preserved in this fallback instead of silently replaying the
   generic lesson.
3. The browser requests only the active scene's image/audio. The API reconstructs the scene prompt
   from the trusted storyboard, calls Google server-side, validates media types/sizes, and caches
   successful output for six hours. It preloads the next image after the active one.
4. Google image failure reveals the animated diagram already under the scene. Google TTS failure
   switches to the selected local `SpeechSynthesis` voice; if speech is unavailable, captions and
   reading-time auto-advance remain functional.
5. The player never asks generated art to reproduce Salesforce UI or render explanatory text.
   Accurate labels stay in application-owned overlays, and the lesson remains the source of truth.

## Web routes

| Route | Page |
|-------|------|
| `/learning` | Academy home: hero + overall progress, KPIs, assigned training, path catalog |
| `/learning/paths/[pathId]` | Path detail: module timeline, lesson checklists, quiz status |
| `/learning/lessons/[lessonId]` | Lesson: content, real-world example, resources, AI mentor panel |
| `/learning/modules/[moduleId]/quiz` | Quiz: question stepper → instant results + answer review |
| `/learning/team` | Admin: team progress + assignment management |
