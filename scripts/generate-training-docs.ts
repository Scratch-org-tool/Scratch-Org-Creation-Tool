/**
 * Training documentation generator.
 *
 * Reads the Salesforce Academy curriculum (the single source of truth in
 * `apps/api/src/modules/learning/curriculum/`) and writes one production doc
 * per learning path into `docs/training/`, plus an index README.
 *
 * Every lesson gets:
 *   - a concept explanation (objectives + full lesson sections + code),
 *   - the real-world example (scenario → solution → outcome),
 *   - key takeaways and official resources,
 *   - a timecoded **5-minute video script** (word-for-word narration +
 *     on-screen direction + demo steps) ready for recording or for external
 *     AI video tools. Recorded videos are uploaded back onto the lesson page
 *     ("Video session" block) by an administrator.
 *
 * Run from the repo root (after `npm run build --workspace=@sfcc/shared`):
 *   npm run docs:training
 *
 * The output is committed, so the docs stay reviewable in PRs. Re-run this
 * script whenever curriculum content changes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEARNING_LEVEL_LABELS,
  LEARNING_PATH_CATEGORY_LABELS,
} from '../packages/shared/src/learning';
import { CURRICULUM } from '../apps/api/src/modules/learning/curriculum';
import type {
  CurriculumLesson,
  CurriculumModule,
  CurriculumPath,
} from '../apps/api/src/modules/learning/curriculum';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'training');

/* ------------------------------------------------------------------ */
/* Script timing model — a 5:00 video at ~145 narrated words/minute    */
/* ------------------------------------------------------------------ */

const TOTAL_SECONDS = 5 * 60;
const WORDS_PER_SECOND = 145 / 60;

const INTRO_SECONDS = 30;
const STORY_SECONDS = 45;
const RECAP_SECONDS = 30;
const CTA_SECONDS = 15;

interface ScriptSegment {
  kind: 'intro' | 'concept' | 'demo' | 'story' | 'recap' | 'cta';
  title: string;
  seconds: number;
  narration: string;
  onScreen: string;
  demoSteps?: string[];
  lowerThird?: string;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function paragraphsOf(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((chunk) => chunk.replace(/^- /gm, '').replace(/\n/g, ' ').trim())
    .filter((chunk) => chunk.length > 0);
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** Trim narration to a word budget on sentence boundaries (never mid-sentence). */
function fitToBudget(text: string, seconds: number): string {
  const budget = Math.max(20, Math.round(seconds * WORDS_PER_SECOND));
  const sentences = sentencesOf(text);
  const kept: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    const count = sentence.split(/\s+/).length;
    if (kept.length > 0 && words + count > budget) break;
    kept.push(sentence);
    words += count;
  }
  return kept.join(' ');
}

const ACTION_VERBS =
  /\b(open|click|create|add|configure|set|enable|assign|choose|select|navigate|go to|run|deploy|install|define|build|drag|save|test|schedule|map|import|export|query|write|use setup|check|declare|call|flip|merge|branch|tag|validate)\b/i;

/** Distill numbered demo steps from the most action-dense paragraph of a section. */
function demoStepsOf(body: string): string[] {
  let best: string[] = [];
  for (const paragraph of paragraphsOf(body)) {
    const actionable = sentencesOf(paragraph).filter(
      (sentence) => sentence.length > 15 && ACTION_VERBS.test(sentence),
    );
    if (actionable.length > best.length) best = actionable;
  }
  return best.length >= 2 ? best.slice(0, 6) : [];
}

function lowerObjective(objective: string): string {
  return objective.replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/**
 * Deterministic 5-minute script: cold open (objectives), one segment per
 * lesson section (code samples become dedicated walk-through beats), the
 * real-world story, a recap, and a call to action.
 */
function buildFiveMinuteScript(
  pathDef: CurriculumPath,
  module: CurriculumModule,
  lesson: CurriculumLesson,
): ScriptSegment[] {
  const segments: ScriptSegment[] = [];

  segments.push({
    kind: 'intro',
    title: `Cold open — why ${lesson.title} matters`,
    seconds: INTRO_SECONDS,
    narration: fitToBudget(
      `Welcome to ${pathDef.title}, and this five-minute session on ${lesson.title}. ${lesson.summary} ` +
        `By the end of this video you will be able to ${lesson.objectives
          .slice(0, 3)
          .map(lowerObjective)
          .join('; ')}. And stick around — we close with a true-to-life story of a team that lived this exact problem.`,
      INTRO_SECONDS,
    ),
    onScreen:
      'Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.',
    lowerThird: `${pathDef.title} · ${module.title}`,
  });

  // Concept/demo beats share the middle of the video.
  const beats: Array<{ section: CurriculumLesson['sections'][number]; code: boolean }> = [];
  for (const section of lesson.sections) {
    beats.push({ section, code: false });
    if (section.code) beats.push({ section, code: true });
  }
  const conceptSeconds = TOTAL_SECONDS - INTRO_SECONDS - STORY_SECONDS - RECAP_SECONDS - CTA_SECONDS;
  const perBeat = Math.floor(conceptSeconds / Math.max(1, beats.length));

  for (const beat of beats) {
    const { section } = beat;
    if (beat.code && section.code) {
      segments.push({
        kind: 'demo',
        title: `Code walk-through — ${section.heading}`,
        seconds: perBeat,
        narration: fitToBudget(
          `Now watch the same idea in code. ${section.code.caption ?? ''} Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.`,
          perBeat,
        ),
        onScreen:
          `Editor view: the ${section.code.language} snippet types itself line by line, with the line under discussion highlighted while the narration explains it.`,
        lowerThird: `Code: ${section.code.language.toUpperCase()}`,
      });
      continue;
    }

    const paragraphs = paragraphsOf(section.body);
    const demoSteps = demoStepsOf(section.body);
    const handsOn = demoSteps.length >= 2;
    segments.push({
      kind: handsOn ? 'demo' : 'concept',
      title: section.heading,
      seconds: perBeat,
      narration: fitToBudget(
        handsOn
          ? `Let's actually do this together. ${paragraphs.join(' ')}`
          : paragraphs.join(' '),
        perBeat,
      ),
      onScreen: handsOn
        ? 'Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.'
        : `Animated explainer diagram for "${section.heading}": the key entities appear and connect exactly as the narration names them.`,
      ...(handsOn ? { demoSteps } : {}),
    });
  }

  segments.push({
    kind: 'story',
    title: `Real story — ${lesson.realWorld.title}`,
    seconds: STORY_SECONDS,
    narration: fitToBudget(
      `Here is why this matters in the real world. ${lesson.realWorld.scenario} What did they do? ${lesson.realWorld.solution} And the payoff: ${lesson.realWorld.outcome}`,
      STORY_SECONDS,
    ),
    onScreen:
      'Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.',
    lowerThird: lesson.realWorld.title,
  });

  segments.push({
    kind: 'recap',
    title: 'Recap — lock it in',
    seconds: RECAP_SECONDS,
    narration: fitToBudget(
      `Before you go, say these back to yourself. ${lesson.keyTakeaways.join('. ')}.`,
      RECAP_SECONDS,
    ),
    onScreen: 'Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.',
  });

  segments.push({
    kind: 'cta',
    title: 'Your next step',
    seconds: CTA_SECONDS,
    narration: fitToBudget(
      `That is ${lesson.title} — the idea, the practice, and the real-world payoff. Head back to the ${module.title} module, mark this lesson complete, and take the quiz to make it count. See you in the next session.`,
      CTA_SECONDS,
    ),
    onScreen: 'Progress ring animates toward complete; the quiz button glows as the outro plays.',
  });

  return segments;
}

/* ------------------------------------------------------------------ */
/* Markdown rendering                                                  */
/* ------------------------------------------------------------------ */

function renderScript(segments: ScriptSegment[]): string {
  const lines: string[] = [];
  const total = segments.reduce((sum, s) => sum + s.seconds, 0);
  lines.push(
    `**Target runtime:** ${formatTime(total)} · **Narration pace:** ~145 words/min · ` +
      `**Segments:** ${segments.length}`,
    '',
    '| # | Time | Segment | Type |',
    '|---|------|---------|------|',
  );
  let cursor = 0;
  segments.forEach((segment, index) => {
    lines.push(
      `| ${index + 1} | ${formatTime(cursor)}–${formatTime(cursor + segment.seconds)} | ${segment.title} | ${segment.kind} |`,
    );
    cursor += segment.seconds;
  });
  lines.push('');

  cursor = 0;
  segments.forEach((segment) => {
    lines.push(`**[${formatTime(cursor)}–${formatTime(cursor + segment.seconds)}] ${segment.title}**`, '');
    lines.push(`- **Narration (word-for-word):** ${segment.narration}`);
    lines.push(`- **On screen:** ${segment.onScreen}`);
    if (segment.demoSteps && segment.demoSteps.length > 0) {
      lines.push('- **Demo steps (screen capture):**');
      segment.demoSteps.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`));
    }
    if (segment.lowerThird) {
      lines.push(`- **Lower third:** ${segment.lowerThird}`);
    }
    lines.push('');
    cursor += segment.seconds;
  });
  return lines.join('\n');
}

function renderLesson(
  pathDef: CurriculumPath,
  module: CurriculumModule,
  lesson: CurriculumLesson,
  moduleIndex: number,
  lessonIndex: number,
): string {
  const lines: string[] = [];
  lines.push(`### Lesson ${moduleIndex + 1}.${lessonIndex + 1} — ${lesson.title}`, '');
  lines.push(
    `**Lesson ID:** \`${lesson.id}\` · **Reading time:** ${lesson.durationMinutes} min · **Video:** 5:00`,
    '',
  );
  lines.push(`> ${lesson.summary}`, '');

  lines.push('**Learning objectives**', '');
  lesson.objectives.forEach((objective) => lines.push(`- ${objective}`));
  lines.push('');

  lines.push('#### Concept explanation', '');
  for (const section of lesson.sections) {
    lines.push(`##### ${section.heading}`, '');
    for (const block of section.body.split(/\n\s*\n/)) {
      lines.push(block.trim(), '');
    }
    if (section.code) {
      if (section.code.caption) lines.push(`*${section.code.caption}*`, '');
      lines.push('```' + section.code.language, section.code.snippet, '```', '');
    }
  }

  lines.push(`#### Real-world example — ${lesson.realWorld.title}`, '');
  lines.push(`- **Scenario:** ${lesson.realWorld.scenario}`);
  lines.push(`- **Solution:** ${lesson.realWorld.solution}`);
  lines.push(`- **Outcome:** ${lesson.realWorld.outcome}`);
  lines.push('');

  lines.push('#### Key takeaways', '');
  lesson.keyTakeaways.forEach((takeaway) => lines.push(`- ${takeaway}`));
  lines.push('');

  if (lesson.resources.length > 0) {
    lines.push('#### Go deeper', '');
    lesson.resources.forEach((resource) =>
      lines.push(`- [${resource.title}](${resource.url})${resource.note ? ` — ${resource.note}` : ''}`),
    );
    lines.push('');
  }

  lines.push('#### 5-minute video script', '');
  lines.push(renderScript(buildFiveMinuteScript(pathDef, module, lesson)));
  lines.push('---', '');
  return lines.join('\n');
}

function renderPath(pathDef: CurriculumPath): string {
  const lessonCount = pathDef.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const lines: string[] = [];
  lines.push(`# ${pathDef.title} — Training Material & Video Scripts`, '');
  lines.push(
    '> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.',
    '> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.',
    '',
  );
  lines.push(
    `**Level:** ${LEARNING_LEVEL_LABELS[pathDef.level]} · ` +
      `**Category:** ${LEARNING_PATH_CATEGORY_LABELS[pathDef.category]} · ` +
      `**Badge:** ${pathDef.badge} · ` +
      `**Modules:** ${pathDef.modules.length} · **Lessons:** ${lessonCount} · ` +
      `**Estimated effort:** ~${pathDef.estimatedHours}h`,
    '',
  );
  lines.push(pathDef.description, '');
  lines.push(`**Skills:** ${pathDef.skills.join(' · ')}`, '');

  lines.push('## Contents', '');
  pathDef.modules.forEach((module, moduleIndex) => {
    lines.push(`- **Module ${moduleIndex + 1}: ${module.title}**`);
    module.lessons.forEach((lesson, lessonIndex) => {
      lines.push(`  - Lesson ${moduleIndex + 1}.${lessonIndex + 1}: ${lesson.title}`);
    });
  });
  lines.push('');

  pathDef.modules.forEach((module, moduleIndex) => {
    lines.push(`## Module ${moduleIndex + 1}: ${module.title}`, '');
    lines.push(module.summary, '');
    lines.push(
      `*Module quiz: 8 questions · pass mark 70% · curated fallback bank of ${module.quizBank.length} questions.*`,
      '',
    );
    module.lessons.forEach((lesson, lessonIndex) => {
      lines.push(renderLesson(pathDef, module, lesson, moduleIndex, lessonIndex));
    });
  });

  return lines.join('\n');
}

function renderIndex(): string {
  const totalModules = CURRICULUM.reduce((sum, p) => sum + p.modules.length, 0);
  const totalLessons = CURRICULUM.reduce(
    (sum, p) => sum + p.modules.reduce((s, m) => s + m.lessons.length, 0),
    0,
  );
  const lines: string[] = [];
  lines.push('# Academy Training Material & 5-Minute Video Scripts', '');
  lines.push(
    '> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.',
    '> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.',
    '',
  );
  lines.push(
    `The Salesforce Academy currently ships **${CURRICULUM.length} learning paths, ` +
      `${totalModules} modules, and ${totalLessons} lessons**. Every lesson below has a complete ` +
      'concept explanation, a real-world example, and a timecoded **5-minute video script** ' +
      '(word-for-word narration, on-screen direction, and demo steps).',
    '',
  );

  lines.push('## Paths', '');
  lines.push('| Path | Level | Category | Modules | Lessons | Doc |');
  lines.push('|------|-------|----------|---------|---------|-----|');
  for (const pathDef of CURRICULUM) {
    const lessonCount = pathDef.modules.reduce((sum, m) => sum + m.lessons.length, 0);
    lines.push(
      `| ${pathDef.title} | ${LEARNING_LEVEL_LABELS[pathDef.level]} | ` +
        `${LEARNING_PATH_CATEGORY_LABELS[pathDef.category]} | ${pathDef.modules.length} | ` +
        `${lessonCount} | [${pathDef.id}.md](./${pathDef.id}.md) |`,
    );
  }
  lines.push('');

  lines.push('## Producing the videos', '');
  lines.push(
    '1. Open the path doc and pick a lesson — each script is exactly five minutes at a ~145 words/min pace.',
    '2. Record it yourself (narration + screen capture per the demo steps), or paste the narration into an AI video tool (HeyGen, Synthesia, InVideo, CapCut…) and use the on-screen directions for the visual track.',
    '3. As an administrator, open the lesson page in the Academy (`/learning/lessons/<lesson-id>`) and upload the finished video in the **Video session** block. Learners with Academy access stream it from there.',
    '4. When curriculum content changes, re-run `npm run docs:training` so scripts and lessons never drift apart.',
    '',
  );
  lines.push('## Admin access control', '');
  lines.push(
    '- The Academy is a locked module: users see it only after an admin grants `learning` (User Access → Manage).',
    '- Admins can additionally restrict any user to **assigned paths only** — unassigned trainings (including all the tracks documented here) stay completely invisible to that user until assigned from Academy Progress.',
    '- Uploading and deleting lesson videos is admin-only; playback is authenticated and limited to users with Academy access.',
    '',
  );
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */

mkdirSync(OUT_DIR, { recursive: true });
const written: string[] = [];
for (const pathDef of CURRICULUM) {
  const file = path.join(OUT_DIR, `${pathDef.id}.md`);
  writeFileSync(file, renderPath(pathDef), 'utf8');
  written.push(file);
}
writeFileSync(path.join(OUT_DIR, 'README.md'), renderIndex(), 'utf8');
written.push(path.join(OUT_DIR, 'README.md'));

console.log(`Generated ${written.length} training docs into ${path.relative(ROOT, OUT_DIR)}/:`);
for (const file of written) console.log(`  - ${path.relative(ROOT, file)}`);
