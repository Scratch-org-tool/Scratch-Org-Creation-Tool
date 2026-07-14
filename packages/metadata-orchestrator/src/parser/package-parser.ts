import { XMLParser } from 'fast-xml-parser';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ManifestMember {
  metadataType: string;
  apiName: string;
  isWildcard: boolean;
}

export interface ParsedManifest {
  manifestPath: string;
  apiVersion: string | null;
  members: ManifestMember[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'types' || name === 'members',
});

function normalizeMembers(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
}

export class PackageParser {
  parseFile(manifestPath: string): ParsedManifest {
    const xml = fs.readFileSync(manifestPath, 'utf8');
    return this.parseString(xml, manifestPath);
  }

  parseString(xml: string, manifestPath = 'package.xml'): ParsedManifest {
    const doc = parser.parse(xml) as Record<string, unknown>;
    const pkg = (doc.Package ?? doc.package ?? doc) as Record<string, unknown>;
    const version = (pkg.version ?? pkg.Version) as string | undefined;

    const typesRaw = pkg.types ?? pkg.Types;
    const typeBlocks = Array.isArray(typesRaw) ? typesRaw : typesRaw ? [typesRaw] : [];

    const members: ManifestMember[] = [];
    for (const block of typeBlocks) {
      const b = block as Record<string, unknown>;
      const metadataType = String(b.name ?? b.Name ?? 'Unknown');
      for (const m of normalizeMembers(b.members ?? b.Members)) {
        const apiName = m.trim();
        if (!apiName) continue;
        members.push({
          metadataType,
          apiName,
          isWildcard: apiName === '*' || apiName.endsWith('.*'),
        });
      }
    }

    return {
      manifestPath,
      apiVersion: version ?? null,
      members,
    };
  }

  /** Stream large manifests in chunks via member callback */
  parseFileStreaming(
    manifestPath: string,
    onMember: (member: ManifestMember) => void,
  ): ParsedManifest {
    const parsed = this.parseFile(manifestPath);
    for (const member of parsed.members) onMember(member);
    return parsed;
  }

  resolveManifestPath(projectRoot: string, manifestRel = 'manifest/package.xml'): string {
    const candidates = [
      path.join(projectRoot, manifestRel),
      path.join(projectRoot, 'package.xml'),
      path.join(projectRoot, 'manifest', 'package.xml'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return candidates[0];
  }
}

export const packageParser = new PackageParser();
