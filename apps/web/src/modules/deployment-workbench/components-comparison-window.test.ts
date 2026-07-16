import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./components-comparison-window.tsx', import.meta.url)),
  'utf8',
);

describe('components comparison window', () => {
  it('uses accessible selection controls and state labels', () => {
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).toContain('aria-label={`Select');
    expect(source).toContain('aria-label="Search component name"');
    expect(source).toContain('aria-label="Clear search"');
    expect(source).toContain("'Collapse metadata type list'");
    expect(source).toContain("'Expand metadata type list'");
  });

  it('exposes diff type toggles and pagination with accessible states', () => {
    expect(source).toContain('aria-pressed={active}');
    expect(source).toContain('type="checkbox"');
    expect(source).toContain('Previous');
    expect(source).toContain('Next');
    expect(source).toContain('No difference');
    expect(source).toContain('Not inspected');
  });

  it('provides a related components panel with add-to-selection actions', () => {
    expect(source).toContain('Show related components for');
    expect(source).toContain('Related components:');
    expect(source).toContain('Add to selection');
    expect(source).toContain('aria-label="Close related components panel"');
  });

  it('uses stable compare keys for selection identity', () => {
    expect(source).toContain('buildCompareKey(');
    expect(source).toContain('onSelectItems(');
  });

  it('loads comparison data automatically and opens XML from component names', () => {
    expect(source).not.toContain('Compare again');
    expect(source).not.toContain('Run comparison');
    expect(source).toContain('Retry metadata loading');
    expect(source).toContain('<MetadataXmlDiffViewer');
    expect(source).toContain('onClick={onOpen}');
  });
});
