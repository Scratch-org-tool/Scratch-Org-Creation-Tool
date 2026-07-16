import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeFile, runBuiltInAnalysis, sanitize } from './built-in-analyzer';

const roots: string[] = [];

function project(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'built-in-analyzer-'));
  roots.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(root, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function rules(relative: string, content: string): string[] {
  return analyzeFile(relative, content).map((issue) => issue.ruleId);
}

describe('built-in Apex rules', () => {
  it('flags SOQL and DML inside loops but not bulk operations outside', () => {
    const flagged = rules('classes/Loops.cls', `
      public with sharing class Loops {
        public void slow(List<Id> ids) {
          for (Id currentId : ids) {
            Account record = [SELECT Id FROM Account WHERE Id = :currentId];
            update record;
          }
        }
      }
    `);
    expect(flagged).toContain('APEX_SOQL_IN_LOOP');
    expect(flagged).toContain('APEX_DML_IN_LOOP');

    const bulk = rules('classes/Bulk.cls', `
      public with sharing class Bulk {
        public void fast(List<Id> ids) {
          List<Account> records = [SELECT Id FROM Account WHERE Id IN :ids];
          update records;
        }
      }
    `);
    expect(bulk).not.toContain('APEX_SOQL_IN_LOOP');
    expect(bulk).not.toContain('APEX_DML_IN_LOOP');
  });

  it('flags Database calls in loops and single-statement loop bodies', () => {
    const flagged = rules('classes/DbLoop.cls', `
      public with sharing class DbLoop {
        public void slow(List<Account> accounts) {
          for (Account record : accounts) Database.update(record);
        }
      }
    `);
    expect(flagged).toContain('APEX_DML_IN_LOOP');
  });

  it('flags dynamic SOQL built with concatenation as critical', () => {
    const issues = analyzeFile('classes/Injection.cls', `
      public with sharing class Injection {
        public List<Account> search(String name) {
          return Database.query('SELECT Id FROM Account WHERE Name = \\'' + name + '\\'');
        }
      }
    `);
    const injection = issues.find((issue) => issue.ruleId === 'APEX_SOQL_INJECTION');
    expect(injection?.severity).toBe('critical');

    const safe = rules('classes/Safe.cls', `
      public with sharing class Safe {
        public List<Account> search() {
          return Database.query('SELECT Id FROM Account');
        }
      }
    `);
    expect(safe).not.toContain('APEX_SOQL_INJECTION');
  });

  it('flags hardcoded Salesforce IDs and instance URLs in literals', () => {
    const flagged = rules('classes/Hardcoded.cls', `
      public with sharing class Hardcoded {
        Id recordTypeId = '0120a000000UVWXAA4';
        String endpoint = 'https://na42.salesforce.com/services/data';
      }
    `);
    expect(flagged).toContain('APEX_HARDCODED_ID');
    expect(flagged).toContain('APEX_HARDCODED_URL');
    expect(rules('classes/Clean.cls', `
      public class Clean { String label = 'Hello world'; }
    `)).not.toContain('APEX_HARDCODED_ID');
  });

  it('flags empty catch blocks, debug statements, and SeeAllData tests', () => {
    const flagged = rules('classes/Sloppy.cls', `
      public with sharing class Sloppy {
        public void work() {
          try {
            System.debug('checkpoint');
          } catch (Exception error) {}
        }
      }
    `);
    expect(flagged).toContain('APEX_EMPTY_CATCH');
    expect(flagged).toContain('APEX_SYSTEM_DEBUG');

    expect(rules('classes/LegacyTest.cls', `
      @isTest(SeeAllData=true)
      private class LegacyTest {
        static void run() {}
      }
    `)).toContain('APEX_SEEALLDATA_TRUE');
  });

  it('requires a sharing declaration only for non-test classes touching data', () => {
    expect(rules('classes/NoSharing.cls', `
      public class NoSharing {
        public List<Account> load() { return [SELECT Id FROM Account]; }
      }
    `)).toContain('APEX_MISSING_SHARING');

    expect(rules('classes/Shared.cls', `
      public virtual with sharing class Shared {
        public List<Account> load() { return [SELECT Id FROM Account]; }
      }
    `)).not.toContain('APEX_MISSING_SHARING');

    expect(rules('classes/PlainUtility.cls', `
      public class PlainUtility {
        public static Integer add(Integer a, Integer b) { return a + b; }
      }
    `)).not.toContain('APEX_MISSING_SHARING');

    expect(rules('classes/DataTest.cls', `
      @isTest
      private class DataTest {
        static void seed() { insert new Account(Name = 'x'); }
      }
    `)).not.toContain('APEX_MISSING_SHARING');

    expect(rules('classes/Elevated.cls', `
      public without sharing class Elevated {
        public List<Account> load() { return [SELECT Id FROM Account]; }
      }
    `)).toContain('APEX_WITHOUT_SHARING');
  });

  it('asks triggers with direct query or DML logic to delegate to handlers', () => {
    expect(rules('triggers/AccountTrigger.trigger', `
      trigger AccountTrigger on Account (before insert) {
        for (Account record : Trigger.new) {
          record.OwnerId = [SELECT Id FROM User LIMIT 1].Id;
        }
      }
    `)).toContain('APEX_TRIGGER_LOGIC');

    expect(rules('triggers/ThinTrigger.trigger', `
      trigger ThinTrigger on Account (before insert) {
        AccountTriggerHandler.run(Trigger.new);
      }
    `)).not.toContain('APEX_TRIGGER_LOGIC');
  });

  it('never matches rules inside comments or string literals', () => {
    expect(rules('classes/Commented.cls', `
      public with sharing class Commented {
        // for (x) { insert record; } System.debug('legacy');
        /* [SELECT Id FROM Account] */
        String note = 'insert this [SELECT] text';
      }
    `)).toEqual([]);
  });
});

describe('built-in Lightning JavaScript rules', () => {
  it('flags eval, debugger, and console statements in lwc/aura sources only', () => {
    const flagged = analyzeFile('force-app/main/default/lwc/widget/widget.js', `
      export default class Widget {
        connectedCallback() {
          eval('code');
          debugger;
          console.log('state');
        }
      }
    `);
    expect(flagged.map((issue) => issue.ruleId)).toEqual(
      expect.arrayContaining(['JS_EVAL', 'JS_DEBUGGER', 'JS_CONSOLE']),
    );
    expect(flagged.find((issue) => issue.ruleId === 'JS_EVAL')?.severity).toBe('critical');

    expect(rules('scripts/build.js', 'console.log("build");')).toEqual([]);
  });
});

describe('built-in metadata rules', () => {
  it('flags flows deployed in a non-active status', () => {
    expect(rules('flows/Order.flow-meta.xml', `
      <?xml version="1.0" encoding="UTF-8"?>
      <Flow xmlns="http://soap.sforce.com/2006/04/metadata">
        <status>Draft</status>
      </Flow>
    `)).toContain('FLOW_INACTIVE_STATUS');

    expect(rules('flows/Live.flow-meta.xml', `
      <Flow><status>Active</status></Flow>
    `)).not.toContain('FLOW_INACTIVE_STATUS');
  });

  it('flags very old component API versions', () => {
    expect(rules('classes/Old.cls-meta.xml', `
      <ApexClass><apiVersion>42.0</apiVersion></ApexClass>
    `)).toContain('META_OLD_API_VERSION');
    expect(rules('classes/Current.cls-meta.xml', `
      <ApexClass><apiVersion>62.0</apiVersion></ApexClass>
    `)).not.toContain('META_OLD_API_VERSION');
  });
});

describe('runBuiltInAnalysis', () => {
  it('walks a project, attributes issues to components, and fingerprints them', () => {
    const root = project({
      'force-app/main/default/classes/Example.cls': `
        public class Example {
          public void run(List<Id> ids) {
            for (Id currentId : ids) { insert new Account(Name = 'x'); }
          }
        }
      `,
      'force-app/main/default/lwc/panel/panel.js': 'eval("x");',
      'force-app/main/default/flows/Draft.flow-meta.xml': '<Flow><status>Draft</status></Flow>',
      'node_modules/skipped/skip.js': 'eval("ignored");',
    });

    const report = runBuiltInAnalysis(root);

    expect(report.engine).toBe('built-in');
    expect(report.scannedFiles).toBe(3);
    expect(report.truncated).toBe(false);
    const ruleIds = report.issues.map((issue) => issue.ruleId);
    expect(ruleIds).toEqual(expect.arrayContaining([
      'APEX_DML_IN_LOOP',
      'APEX_MISSING_SHARING',
      'JS_EVAL',
      'FLOW_INACTIVE_STATUS',
    ]));
    const apexIssue = report.issues.find((issue) => issue.ruleId === 'APEX_DML_IN_LOOP');
    expect(apexIssue?.component).toBe('ApexClass:Example');
    expect(apexIssue?.file).toBe('force-app/main/default/classes/Example.cls');
    expect(apexIssue?.line).toBeGreaterThan(1);
    expect(apexIssue?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    const jsIssue = report.issues.find((issue) => issue.ruleId === 'JS_EVAL');
    expect(jsIssue?.component).toBe('LightningComponentBundle:panel');
  });
});

describe('sanitize', () => {
  it('blanks comments and string contents while preserving offsets and lines', () => {
    const source = "insert a; // insert b;\nString x = 'insert c';";
    const { code, strings } = sanitize(source);
    expect(code.length).toBe(source.length);
    expect(code).toContain('insert a;');
    expect(code).not.toContain('insert b');
    expect(code).not.toContain('insert c');
    expect(code.split('\n').length).toBe(source.split('\n').length);
    expect(strings).toEqual([{ value: 'insert c', index: source.indexOf("'insert c'") }]);
  });
});
