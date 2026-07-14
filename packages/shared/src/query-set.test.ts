import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildGenericDeployQuery,
  replaceOrApplyLimit,
} from './query-set.js';

describe('replaceOrApplyLimit', () => {
  it('appends LIMIT when missing', () => {
    assert.equal(
      replaceOrApplyLimit('SELECT Name FROM Account', 500),
      'SELECT Name FROM Account LIMIT 500',
    );
  });

  it('replaces existing LIMIT', () => {
    assert.equal(
      replaceOrApplyLimit('SELECT Name FROM Account LIMIT 200', 500),
      'SELECT Name FROM Account LIMIT 500',
    );
  });

  it('strips OFFSET when replacing limit', () => {
    assert.equal(
      replaceOrApplyLimit('SELECT Name FROM Account LIMIT 50 OFFSET 100', 500),
      'SELECT Name FROM Account LIMIT 500',
    );
  });
});

describe('buildGenericDeployQuery', () => {
  it('defaults to SELECT Name with record limit', () => {
    assert.equal(
      buildGenericDeployQuery({ objectName: 'Account', recordLimit: 100 }),
      'SELECT Name FROM Account LIMIT 100',
    );
  });

  it('strips Id from user SOQL and applies limit', () => {
    assert.equal(
      buildGenericDeployQuery({
        soql: 'SELECT Id, Name, Industry FROM Account LIMIT 200',
        objectName: 'Account',
        recordLimit: 500,
      }),
      'SELECT Name, Industry FROM Account LIMIT 500',
    );
  });

  it('preserves existing LIMIT when recordLimit is omitted', () => {
    assert.equal(
      buildGenericDeployQuery({
        soql: 'SELECT Name FROM Account LIMIT 750',
        objectName: 'Account',
      }),
      'SELECT Name FROM Account LIMIT 750',
    );
  });
});
