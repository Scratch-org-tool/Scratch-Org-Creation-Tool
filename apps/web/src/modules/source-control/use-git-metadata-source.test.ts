import { describe, expect, it } from 'vitest';
import {
  gitBranchRequestKey,
  isValidatedBranchSelection,
  type GitMetadataSourceState,
} from './use-git-metadata-source';

const source: GitMetadataSourceState = {
  provider: 'azure_devops',
  connectionId: 'connection-1',
  namespace: '',
  project: 'Core',
  repositoryId: 'repo-1',
  repo: 'metadata',
  branch: 'main',
  manifestPath: 'manifest/package.xml',
};

describe('git branch validation', () => {
  it('does not accept a branch before its repository request completes', () => {
    expect(isValidatedBranchSelection(source, [], null, false)).toBe(false);
    expect(isValidatedBranchSelection(
      source,
      ['main'],
      gitBranchRequestKey(source),
      true,
    )).toBe(false);
  });

  it('accepts only a branch returned for the current repository coordinates', () => {
    const key = gitBranchRequestKey(source);
    expect(isValidatedBranchSelection(source, ['main', 'release'], key, false)).toBe(true);
    expect(isValidatedBranchSelection(
      { ...source, branch: 'missing' },
      ['main', 'release'],
      key,
      false,
    )).toBe(false);
    expect(isValidatedBranchSelection(
      { ...source, repositoryId: 'repo-2' },
      ['main'],
      key,
      false,
    )).toBe(false);
  });
});
