# Academy Training Material & 5-Minute Video Scripts

> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.
> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.

The Salesforce Academy currently ships **7 learning paths, 22 modules, and 69 lessons**. Every lesson below has a complete concept explanation, a real-world example, and a timecoded **5-minute video script** (word-for-word narration, on-screen direction, and demo steps).

## Paths

| Path | Level | Category | Modules | Lessons | Doc |
|------|-------|----------|---------|---------|-----|
| Salesforce Foundations | Beginner | Salesforce core curriculum | 3 | 9 | [sf-foundations.md](./sf-foundations.md) |
| Admin & Configuration Mastery | Intermediate | Salesforce core curriculum | 3 | 10 | [sf-admin.md](./sf-admin.md) |
| JavaScript Mastery | Intermediate | Programming & platform skills | 3 | 9 | [js-training.md](./js-training.md) |
| Java Programming | Intermediate | Programming & platform skills | 3 | 9 | [java-training.md](./java-training.md) |
| Platform Developer Track | Advanced | Salesforce core curriculum | 4 | 13 | [sf-developer.md](./sf-developer.md) |
| Release Management & DevOps | Advanced | Delivery & release management | 3 | 9 | [release-management.md](./release-management.md) |
| Architect & DevOps Mastery | Expert | Salesforce core curriculum | 3 | 10 | [sf-architect.md](./sf-architect.md) |

## Producing the videos

1. Open the path doc and pick a lesson — each script is exactly five minutes at a ~145 words/min pace.
2. Record it yourself (narration + screen capture per the demo steps), or paste the narration into an AI video tool (HeyGen, Synthesia, InVideo, CapCut…) and use the on-screen directions for the visual track.
3. As an administrator, open the lesson page in the Academy (`/learning/lessons/<lesson-id>`) and upload the finished video in the **Video session** block. Learners with Academy access stream it from there.
4. When curriculum content changes, re-run `npm run docs:training` so scripts and lessons never drift apart.

## Admin access control

- The Academy is a locked module: users see it only after an admin grants `learning` (User Access → Manage).
- Admins can additionally restrict any user to **assigned paths only** — unassigned trainings (including all the tracks documented here) stay completely invisible to that user until assigned from Academy Progress.
- Uploading and deleting lesson videos is admin-only; playback is authenticated and limited to users with Academy access.
