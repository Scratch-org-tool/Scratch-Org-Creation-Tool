import { describe, expect, it } from 'vitest';
import { buildPicklistDependencies, decodeValidFor } from './picklist-dependency.util';

describe('Salesforce picklist dependency decoding', () => {
  it('decodes validFor bits in controller metadata order', () => {
    // 10100000 => controller indexes 0 and 2.
    expect(decodeValidFor(Buffer.from([0xa0]).toString('base64'), ['5000', '4900', '4600']))
      .toEqual(['5000', '4600']);
  });

  it('retains active dependent values with decoded controllers', () => {
    expect(buildPicklistDependencies([
      { value: 'North', active: true, validFor: Buffer.from([0x40]).toString('base64') },
      { value: 'Inactive', active: false, validFor: Buffer.from([0x80]).toString('base64') },
    ], ['5000', '4900'])).toEqual([
      { value: 'North', validFor: ['4900'] },
    ]);
  });
});
