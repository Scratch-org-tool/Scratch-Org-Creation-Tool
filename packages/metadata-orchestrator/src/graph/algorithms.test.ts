import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { kahnTopologicalSort } from './algorithms';
import { defaultPriority, parseMetadataNodeId } from '../types/metadata-node';

function priorityCompare(a: string, b: string): number {
  const pa = defaultPriority(parseMetadataNodeId(a).metadataType);
  const pb = defaultPriority(parseMetadataNodeId(b).metadataType);
  if (pa !== pb) return pa - pb;
  return a.localeCompare(b);
}

describe('kahnTopologicalSort', () => {
  it('sorts indegree-0 CustomObject before ApexClass when using priority compare', () => {
    const nodes = [
      'ApexClass:MyService',
      'CustomObject:Account_Partner__c',
      'LightningComponentBundle:myLwc',
    ];
    const adjacency = new Map<string, string[]>([
      ['LightningComponentBundle:myLwc', ['ApexClass:MyService', 'CustomObject:Account_Partner__c']],
    ]);

    const sorted = kahnTopologicalSort(nodes, adjacency, priorityCompare);
    assert.ok(sorted);
    const objectIdx = sorted!.indexOf('CustomObject:Account_Partner__c');
    const apexIdx = sorted!.indexOf('ApexClass:MyService');
    const lwcIdx = sorted!.indexOf('LightningComponentBundle:myLwc');

    assert.ok(objectIdx < lwcIdx, 'CustomObject should deploy before LWC');
    assert.ok(apexIdx < lwcIdx, 'ApexClass should deploy before LWC');
    assert.ok(objectIdx < apexIdx, 'CustomObject should deploy before ApexClass among roots');
  });

  it('respects dependency edges over priority', () => {
    const nodes = ['ApexClass:DependsOnObj', 'CustomObject:LateObject__c'];
    const adjacency = new Map<string, string[]>([
      ['ApexClass:DependsOnObj', ['CustomObject:LateObject__c']],
    ]);

    const sorted = kahnTopologicalSort(nodes, adjacency, priorityCompare);
    assert.deepEqual(sorted, ['CustomObject:LateObject__c', 'ApexClass:DependsOnObj']);
  });
});
