import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LEARNING_FEATURES,
  LEARNING_FEATURES,
  LEARNING_QUIZ_PASS_PERCENT,
  averagePercent,
  calculateQuizScorePercent,
  isModuleCompleted,
  isPathCompleted,
  isQuizPassed,
  learningAssignmentCreateSchema,
  learningQuizSubmitSchema,
  learningTutorAskSchema,
  moduleProgressPercent,
  pathProgressPercent,
  quizStatusLabel,
  resolveLearningFeatureAccess,
  resolveLearningFeatures,
} from './learning';

describe('calculateQuizScorePercent', () => {
  it('rounds to whole percent', () => {
    assert.equal(calculateQuizScorePercent(5, 8), 63);
    assert.equal(calculateQuizScorePercent(8, 8), 100);
    assert.equal(calculateQuizScorePercent(0, 8), 0);
  });

  it('is resilient to bad input', () => {
    assert.equal(calculateQuizScorePercent(3, 0), 0);
    assert.equal(calculateQuizScorePercent(-2, 8), 0);
    assert.equal(calculateQuizScorePercent(12, 8), 100);
    assert.equal(calculateQuizScorePercent(Number.NaN, 8), 0);
  });
});

describe('isQuizPassed', () => {
  it('passes at exactly the threshold', () => {
    assert.equal(isQuizPassed(LEARNING_QUIZ_PASS_PERCENT), true);
    assert.equal(isQuizPassed(LEARNING_QUIZ_PASS_PERCENT - 1), false);
  });

  it('supports custom thresholds', () => {
    assert.equal(isQuizPassed(80, 90), false);
    assert.equal(isQuizPassed(95, 90), true);
  });
});

describe('module + path progress', () => {
  it('counts each lesson and the quiz as one unit', () => {
    assert.equal(moduleProgressPercent(0, 4, false), 0);
    assert.equal(moduleProgressPercent(4, 4, false), 80);
    assert.equal(moduleProgressPercent(4, 4, true), 100);
    assert.equal(moduleProgressPercent(2, 4, false), 40);
  });

  it('requires all lessons AND a passed quiz for completion', () => {
    assert.equal(isModuleCompleted(4, 4, true), true);
    assert.equal(isModuleCompleted(4, 4, false), false);
    assert.equal(isModuleCompleted(3, 4, true), false);
  });

  it('aggregates path progress across modules', () => {
    const modules = [
      { lessonsCompleted: 4, lessonCount: 4, quizPassed: true },
      { lessonsCompleted: 1, lessonCount: 3, quizPassed: false },
    ];
    // (4+1 + 1+0) / (5 + 4) = 6/9
    assert.equal(pathProgressPercent(modules), 67);
    assert.equal(isPathCompleted(modules), false);
    assert.equal(
      isPathCompleted([{ lessonsCompleted: 3, lessonCount: 3, quizPassed: true }]),
      true,
    );
    assert.equal(isPathCompleted([]), false);
    assert.equal(pathProgressPercent([]), 0);
  });
});

describe('averagePercent', () => {
  it('returns null for empty input and rounds otherwise', () => {
    assert.equal(averagePercent([]), null);
    assert.equal(averagePercent([70, 85]), 78);
  });
});

describe('quizStatusLabel', () => {
  const base = {
    questionCount: 8,
    passPercent: 70,
    attemptCount: 0,
    bestScorePercent: null,
    passed: false,
    lastAttemptAt: null,
  };

  it('describes not attempted, retry, and passed states', () => {
    assert.equal(quizStatusLabel(base), 'Not attempted');
    assert.equal(
      quizStatusLabel({ ...base, attemptCount: 2, bestScorePercent: 55 }),
      'Best 55% · retry',
    );
    assert.equal(
      quizStatusLabel({ ...base, attemptCount: 1, bestScorePercent: 88, passed: true }),
      'Passed · 88%',
    );
  });
});

describe('learning feature access (admin gating)', () => {
  it('gives admins every feature', () => {
    const features = resolveLearningFeatures({ role: 'admin', grantedModules: [] });
    assert.deepEqual(features, LEARNING_FEATURES);
    const access = resolveLearningFeatureAccess({ role: 'admin', grantedModules: [] });
    assert.deepEqual(access.categories, ['salesforce', 'javascript', 'java', 'devops']);
    assert.equal(access.mentor && access.video && access.quiz, true);
  });

  it('gives nothing without the learning module', () => {
    assert.deepEqual(resolveLearningFeatures({ role: 'user', grantedModules: ['data'] }), []);
    assert.deepEqual(resolveLearningFeatures(null), []);
    const access = resolveLearningFeatureAccess({ role: 'user', grantedModules: [] });
    assert.deepEqual(access, { categories: [], mentor: false, video: false, quiz: false });
  });

  it('falls back to the default baseline when nothing is customised', () => {
    const features = resolveLearningFeatures({ role: 'user', grantedModules: ['learning'] });
    assert.deepEqual(features.slice().sort(), DEFAULT_LEARNING_FEATURES.slice().sort());
    const access = resolveLearningFeatureAccess({ role: 'user', grantedModules: ['learning'] });
    // Baseline: Salesforce track only; new tracks stay hidden until granted.
    assert.deepEqual(access.categories, ['salesforce']);
    assert.equal(access.mentor && access.video && access.quiz, true);
  });

  it('lets explicit grants unlock new tracks and drop capabilities', () => {
    const access = resolveLearningFeatureAccess({
      role: 'user',
      grantedModules: ['learning'],
      learningFeatures: ['category:javascript', 'category:java', 'capability:quiz'],
    });
    assert.deepEqual(access.categories, ['javascript', 'java']);
    assert.equal(access.quiz, true);
    assert.equal(access.mentor, false);
    assert.equal(access.video, false);
  });

  it('ignores unknown feature keys', () => {
    const access = resolveLearningFeatureAccess({
      role: 'user',
      grantedModules: ['learning'],
      learningFeatures: ['category:python', 'capability:quiz'],
    });
    assert.deepEqual(access.categories, []);
    assert.equal(access.quiz, true);
  });
});

describe('input schemas', () => {
  it('accepts a valid quiz submission', () => {
    const parsed = learningQuizSubmitSchema.safeParse({
      answers: [
        { questionId: 'q1', selectedIndex: 2 },
        { questionId: 'q2', selectedIndex: null },
      ],
    });
    assert.equal(parsed.success, true);
  });

  it('rejects out-of-range answer indexes', () => {
    const parsed = learningQuizSubmitSchema.safeParse({
      answers: [{ questionId: 'q1', selectedIndex: 42 }],
    });
    assert.equal(parsed.success, false);
  });

  it('validates tutor questions and history length', () => {
    assert.equal(
      learningTutorAskSchema.safeParse({ question: 'What is a governor limit?' }).success,
      true,
    );
    assert.equal(learningTutorAskSchema.safeParse({ question: '' }).success, false);
    const tooLongHistory = Array.from({ length: 13 }, () => ({
      role: 'user' as const,
      content: 'hi',
    }));
    assert.equal(
      learningTutorAskSchema.safeParse({ question: 'x', history: tooLongHistory }).success,
      false,
    );
  });

  it('validates assignment creation payloads', () => {
    assert.equal(
      learningAssignmentCreateSchema.safeParse({
        userIds: ['DPT_abc'],
        pathIds: ['sf-foundations'],
        dueAt: '2026-08-01T00:00:00.000Z',
      }).success,
      true,
    );
    assert.equal(
      learningAssignmentCreateSchema.safeParse({ userIds: [], pathIds: ['sf-foundations'] })
        .success,
      false,
    );
    assert.equal(
      learningAssignmentCreateSchema.safeParse({
        userIds: ['DPT_abc'],
        pathIds: ['sf-foundations'],
        dueAt: 'tomorrow',
      }).success,
      false,
    );
  });
});
