import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LEARNING_CORE_PATH_IDS,
  LEARNING_FEATURES,
  LEARNING_PATH_IDS,
  canAccessLearningPath,
  canUseLearningFeature,
  resolveLearningFeatures,
  resolveLearningPaths,
  sanitizeLearningFeatures,
  sanitizeLearningPathIds,
} from './learning-access.js';

describe('learning-access', () => {
  it('sanitizes path and feature ids', () => {
    assert.deepEqual(sanitizeLearningPathIds(['sf-foundations', 'nope', 'java-fundamentals']), [
      'sf-foundations',
      'java-fundamentals',
    ]);
    assert.deepEqual(sanitizeLearningFeatures(['videos', 'hack', 'mentor']), ['videos', 'mentor']);
  });

  it('admins receive every path and feature', () => {
    const profile = { role: 'admin' as const, grantedModules: [] as string[] };
    assert.deepEqual(resolveLearningPaths(profile), [...LEARNING_PATH_IDS]);
    assert.deepEqual(resolveLearningFeatures(profile), [...LEARNING_FEATURES]);
  });

  it('without learning module, nothing is granted', () => {
    const profile = { role: 'user' as const, grantedModules: ['dashboard'] };
    assert.deepEqual(resolveLearningPaths(profile), []);
    assert.deepEqual(resolveLearningFeatures(profile), []);
  });

  it('learning without configured lists falls back to Salesforce core + all features', () => {
    const profile = { role: 'user' as const, grantedModules: ['learning'] };
    assert.deepEqual(resolveLearningPaths(profile), [...LEARNING_CORE_PATH_IDS]);
    assert.deepEqual(resolveLearningFeatures(profile), [...LEARNING_FEATURES]);
    assert.equal(canAccessLearningPath(profile, 'js-fundamentals'), false);
    assert.equal(canAccessLearningPath(profile, 'sf-foundations'), true);
    assert.equal(canUseLearningFeature(profile, 'videos'), true);
  });

  it('explicit lists restrict tracks and features', () => {
    const profile = {
      role: 'user' as const,
      grantedModules: ['learning'],
      grantedLearningPaths: ['js-fundamentals', 'release-management'],
      grantedLearningFeatures: ['videos', 'quizzes'],
    };
    assert.deepEqual(resolveLearningPaths(profile), ['js-fundamentals', 'release-management']);
    assert.deepEqual(resolveLearningFeatures(profile), ['videos', 'quizzes']);
    assert.equal(canUseLearningFeature(profile, 'mentor'), false);
  });
});
