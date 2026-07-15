import type { MetadataRepository } from '../repository/metadata-repository';
import { DependencyGraph } from './dependency-graph';
import { tarjanScc, kahnTopologicalSort, condenseScc } from './algorithms';
import { defaultPriority, parseMetadataNodeId } from '../types/metadata-node';

export class GraphEngine {
  private detectedCycles: string[][] = [];

  constructor(private readonly graph: DependencyGraph) {}

  static fromRepository(repo: MetadataRepository): GraphEngine {
    return new GraphEngine(new DependencyGraph(repo));
  }

  get dependencyGraph(): DependencyGraph {
    return this.graph;
  }

  findCycles(): string[][] {
    return tarjanScc(this.graph.toAdjacencyList());
  }

  recordDetectedCycles(cycles: string[][]): void {
    this.detectedCycles = cycles.map((cycle) => [...cycle]);
  }

  getDetectedCycles(): string[][] {
    return this.detectedCycles.map((cycle) => [...cycle]);
  }

  topologicalOrder(): string[] | null {
    const nodes = this.graph.repository.allNodes().map((n) => n.id);
    const compareFn = (a: string, b: string) => {
      const pa = defaultPriority(parseMetadataNodeId(a).metadataType);
      const pb = defaultPriority(parseMetadataNodeId(b).metadataType);
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    };
    return kahnTopologicalSort(nodes, this.graph.toAdjacencyList(), compareFn);
  }

  /** Break cycles using priority heuristics within each SCC */
  resolveCyclesWithHeuristics(): void {
    const repo = this.graph.repository;
    const sccs = this.findCycles();
    if (sccs.length === 0) return;

    const sccOrder = condenseScc(sccs, (id) => {
      const { metadataType } = parseMetadataNodeId(id);
      return defaultPriority(metadataType);
    });

    for (const component of sccs) {
      component.sort((a, b) => {
        const pa = defaultPriority(parseMetadataNodeId(a).metadataType);
        const pb = defaultPriority(parseMetadataNodeId(b).metadataType);
        if (pa !== pb) return pa - pb;
        return (sccOrder.get(a) ?? 0) - (sccOrder.get(b) ?? 0);
      });

      for (let i = 1; i < component.length; i++) {
        const higher = component[i - 1];
        const lower = component[i];
        const higherNode = repo.getNode(higher);
        const lowerNode = repo.getNode(lower);
        if (higherNode?.dependencies.has(lower)) {
          higherNode.dependencies.delete(lower);
          higherNode.outdegree = higherNode.dependencies.size;
          lowerNode?.dependents.delete(higher);
          if (lowerNode) lowerNode.indegree = lowerNode.dependents.size;
        }
      }
    }

    for (const node of repo.allNodes()) {
      if (node.indegree === 0 && node.deploymentState === 'DISCOVERED') {
        node.deploymentState = 'READY';
      }
    }
  }

  markAllReadyWhereIndegreeZero(): void {
    for (const node of this.graph.repository.allNodes()) {
      if (node.indegree === 0 && node.deploymentState === 'DISCOVERED') {
        node.deploymentState = 'READY';
      }
    }
  }
}
