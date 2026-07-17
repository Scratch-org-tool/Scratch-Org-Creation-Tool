import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildGenericDeployQuery,
  extractFieldsFromSoql,
  extractObjectFromSoql,
  replaceOrApplyLimit,
  stripIdFromSelect,
  stripSelectSubqueries,
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

  it('collapses multi-line SOQL from the custom editor into one line', () => {
    assert.equal(
      buildGenericDeployQuery({
        soql: 'SELECT\n  Id,\n  BillingStreet,\n  Name\nFROM Account\nWHERE Name != null',
        objectName: 'Account',
        recordLimit: 200,
      }),
      'SELECT BillingStreet, Name FROM Account WHERE Name != null LIMIT 200',
    );
  });

  it('drops relationship subqueries but keeps the driving object query intact', () => {
    assert.equal(
      buildGenericDeployQuery({
        soql: "SELECT Id, Name, (SELECT Id, LastName FROM Contacts WHERE LastName != null) FROM Account WHERE Industry = 'Tech'",
        objectName: 'Account',
        recordLimit: 100,
      }),
      "SELECT Name FROM Account WHERE Industry = 'Tech' LIMIT 100",
    );
  });

  it('keeps semi-join WHERE subqueries untouched', () => {
    assert.equal(
      buildGenericDeployQuery({
        soql: "SELECT Id, LastName FROM Contact WHERE AccountId IN (SELECT Id FROM Account WHERE Industry = 'Tech')",
        objectName: 'Contact',
        recordLimit: 50,
      }),
      "SELECT LastName FROM Contact WHERE AccountId IN (SELECT Id FROM Account WHERE Industry = 'Tech') LIMIT 50",
    );
  });
});

describe('subquery-aware SOQL helpers', () => {
  const relatedSoql =
    'SELECT Id, Name, (SELECT Id, LastName FROM Contacts) FROM Account WHERE Name != null';

  it('extractObjectFromSoql resolves the top-level object, not the subquery', () => {
    assert.equal(extractObjectFromSoql(relatedSoql), 'Account');
    assert.equal(
      extractObjectFromSoql('SELECT Id FROM Contact WHERE AccountId IN (SELECT Id FROM Account)'),
      'Contact',
    );
  });

  it('extractFieldsFromSoql keeps subqueries as single entries', () => {
    assert.deepEqual(extractFieldsFromSoql(relatedSoql), [
      'Id',
      'Name',
      '(SELECT Id, LastName FROM Contacts)',
    ]);
  });

  it('stripSelectSubqueries removes only the subquery entries', () => {
    assert.equal(
      stripSelectSubqueries(relatedSoql),
      'SELECT Id, Name FROM Account WHERE Name != null',
    );
  });

  it('stripSelectSubqueries falls back to Id when only subqueries were selected', () => {
    assert.equal(
      stripSelectSubqueries('SELECT (SELECT Id FROM Contacts) FROM Account'),
      'SELECT Id FROM Account',
    );
  });

  it('stripIdFromSelect does not touch Id inside subqueries', () => {
    assert.equal(
      stripIdFromSelect(relatedSoql),
      'SELECT Name, (SELECT Id, LastName FROM Contacts) FROM Account WHERE Name != null',
    );
  });
});
