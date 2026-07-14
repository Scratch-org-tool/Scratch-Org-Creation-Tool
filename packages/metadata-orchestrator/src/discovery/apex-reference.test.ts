import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MetadataRepository } from '../repository/metadata-repository';
import { applyApexReferenceDiscovery } from './apex-reference';

describe('applyApexReferenceDiscovery', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-ref-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('infers CustomObject edge from SOQL FROM clause', () => {
    const clsPath = path.join(tmpDir, 'PartnerService.cls');
    fs.writeFileSync(
      clsPath,
      `public class PartnerService {
  public void run() {
    List<Account_Partner__c> rows = [SELECT Id FROM Account_Partner__c];
  }
}`,
    );

    const repo = new MetadataRepository();
    repo.getOrCreate('ApexClass', 'PartnerService');
    repo.getOrCreate('CustomObject', 'Account_Partner__c');
    const components = [
      { metadataType: 'ApexClass', apiName: 'PartnerService', filePath: clsPath },
    ];

    applyApexReferenceDiscovery(repo, components, tmpDir);

    const apex = repo.getNode('ApexClass:PartnerService');
    assert.ok(apex?.dependencies.has('CustomObject:Account_Partner__c'));
  });

  it('infers CustomObject edge from Schema.SObjectType', () => {
    const clsPath = path.join(tmpDir, 'SchemaService.cls');
    fs.writeFileSync(
      clsPath,
      `public class SchemaService {
  public Schema.DescribeSObjectResult describe() {
    return Schema.SObjectType.Foo_Bar__c.getDescribe();
  }
}`,
    );

    const repo = new MetadataRepository();
    repo.getOrCreate('ApexClass', 'SchemaService');
    repo.getOrCreate('CustomObject', 'Foo_Bar__c');
    const components = [
      { metadataType: 'ApexClass', apiName: 'SchemaService', filePath: clsPath },
    ];

    applyApexReferenceDiscovery(repo, components, tmpDir);

    const apex = repo.getNode('ApexClass:SchemaService');
    assert.ok(apex?.dependencies.has('CustomObject:Foo_Bar__c'));
  });

  it('infers CustomField edge from Object__c.Field__c token', () => {
    const clsPath = path.join(tmpDir, 'FieldService.cls');
    fs.writeFileSync(
      clsPath,
      `public class FieldService {
  public void check() {
    String s = MyObj__c.Status__c;
  }
}`,
    );

    const repo = new MetadataRepository();
    repo.getOrCreate('ApexClass', 'FieldService');
    repo.getOrCreate('CustomObject', 'MyObj__c');
    repo.getOrCreate('CustomField', 'MyObj__c.Status__c');
    const components = [
      { metadataType: 'ApexClass', apiName: 'FieldService', filePath: clsPath },
    ];

    applyApexReferenceDiscovery(repo, components, tmpDir);

    const apex = repo.getNode('ApexClass:FieldService');
    assert.ok(apex?.dependencies.has('CustomObject:MyObj__c'));
    assert.ok(apex?.dependencies.has('CustomField:MyObj__c.Status__c'));
  });
});
