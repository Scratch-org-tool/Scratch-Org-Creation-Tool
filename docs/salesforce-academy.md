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
  - **Story mode (visual + voice)** — the mentor directs an animated, scene-by-scene explainer:
    the LLM scripts a storyboard (narration + diagram spec per scene) which the app renders as
    animated graphics (flows, comparisons, timelines, stacks, callouts) with **spoken narration**
    via the browser's speech engine and always-on captions. One-click stories exist for the whole
    lesson and for the real-world scenario ("Watch animated"), plus a free-form "explain anything
    visually" prompt. Player controls: play/pause, scene scrubbing, voice on/off, narration speed.
  - **Chat mode** — the classic Q&A tutor with real-world examples and follow-up suggestions;
    every reply has a "Listen" button for voice playback.
  Powered by the same NVIDIA LLM integration as the platform copilot; storyboards fall back to a
  deterministic lesson-derived script when AI is unavailable, so story mode always works.
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
| POST | `/api/learning/tutor/explainer` | AI-scripted animated storyboard (`{lessonId, focus?, question?}`) |
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

The Academy reuses the platform's NVIDIA NIM integration (`NVIDIA_API_KEY` etc. in `apps/api/.env`).

| Variable | Default | Purpose |
|----------|---------|---------|
| `LEARNING_QUIZ_AI_TIMEOUT_MS` | `25000` | Budget for AI quiz generation before static fallback |
| `LEARNING_TUTOR_TIMEOUT_MS` | `30000` | Budget for AI mentor answers |
| `LEARNING_EXPLAINER_TIMEOUT_MS` | `30000` | Budget for AI storyboard scripting before static fallback |

Without a valid key everything still works: quizzes serve the curated bank, the mentor returns
the platform's dev-mode response, and visual stories use the lesson-derived static storyboard.

### Visual story pipeline

1. `POST /learning/tutor/explainer` asks the LLM for a JSON storyboard (4–6 scenes; each scene =
   spoken narration + a diagram spec choosing from `flow | compare | stack | timeline | callout |
   grid` with icon/accent whitelists).
2. The response is passed through `sanitizeStoryboard` (`@sfcc/shared`): unknown icons/kinds/
   accents fall back to safe defaults, strings are length-clamped, and boards with fewer than 3
   usable scenes are rejected in favor of the static lesson-derived storyboard.
3. Storyboards are cached in-process per lesson/focus/question for 6 hours.
4. The web player renders scenes with framer-motion and narrates them with the browser's
   SpeechSynthesis API (no audio ever leaves the machine); when voice is off or unsupported,
   scenes auto-advance on a reading-time estimate.

## Web routes

| Route | Page |
|-------|------|
| `/learning` | Academy home: hero + overall progress, KPIs, assigned training, path catalog |
| `/learning/paths/[pathId]` | Path detail: module timeline, lesson checklists, quiz status |
| `/learning/lessons/[lessonId]` | Lesson: content, real-world example, resources, AI mentor panel |
| `/learning/modules/[moduleId]/quiz` | Quiz: question stepper → instant results + answer review |
| `/learning/team` | Admin: team progress + assignment management |
