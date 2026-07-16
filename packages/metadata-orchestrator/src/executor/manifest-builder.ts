import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MetadataRepository } from '../repository/metadata-repository';
import type { DeploymentBatch } from '../types/plan';

export class ManifestBuilder {
  constructor(
    private readonly workDir: string,
    private readonly apiVersion = '62.0',
  ) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  buildBatchManifest(
    batch: DeploymentBatch,
    repo: MetadataRepository,
    apiVersion = this.apiVersion,
  ): string {
    const byType = new Map<string, string[]>();
    for (const nodeId of batch.nodeIds) {
      const node = repo.getNode(nodeId);
      if (!node) continue;
      const list = byType.get(node.metadataType) ?? [];
      list.push(node.apiName);
      byType.set(node.metadataType, list);
    }

    const typesXml = [...byType.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, members]) => {
        const memberLines = [...new Set(members)]
          .sort()
          .map((m) => `        <members>${escapeXml(m)}</members>`)
          .join('\n');
        return `    <types>\n${memberLines}\n        <name>${escapeXml(name)}</name>\n    </types>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
${typesXml}
    <version>${apiVersion}</version>
</Package>
`;

    const manifestPath = path.join(this.workDir, `batch-${batch.batchNumber}-package.xml`);
    fs.writeFileSync(manifestPath, xml, 'utf8');
    batch.tempManifestPath = manifestPath;
    return manifestPath;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
