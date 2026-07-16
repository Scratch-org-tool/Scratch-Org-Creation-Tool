import type { MetadataRepository } from '../repository/metadata-repository';
import type { ScannedComponent } from '../scanner/source-scanner';
import type { TargetOrgProfile } from '../types/deploy-source';
import { applyKnownRules, applyGreenfieldRules } from './known-rules';
import { applyXmlReferenceDiscovery } from './xml-reference';
import { applyApexReferenceDiscovery } from './apex-reference';
import { GraphEngine } from '../graph/graph-engine';

export interface DiscoveryOptions {
  projectRoot: string;
  applyLearnedEdges?: boolean;
  targetOrgProfile?: TargetOrgProfile;
}

export class DependencyDiscoveryEngine {
  discover(
    repo: MetadataRepository,
    components: ScannedComponent[],
    options: DiscoveryOptions,
  ): GraphEngine {
    applyKnownRules(repo, components);
    if (options.targetOrgProfile === 'greenfield') {
      applyGreenfieldRules(repo, components);
    }
    applyXmlReferenceDiscovery(repo, components, options.projectRoot);
    applyApexReferenceDiscovery(repo, components, options.projectRoot);

    const engine = GraphEngine.fromRepository(repo);
    engine.recordDetectedCycles(engine.findCycles());
    engine.resolveCyclesWithHeuristics();
    engine.markAllReadyWhereIndegreeZero();
    return engine;
  }
}

export const dependencyDiscoveryEngine = new DependencyDiscoveryEngine();
