import type { MetadataRepository } from '../repository/metadata-repository';

export class DependencyGraph {
  constructor(private readonly repo: MetadataRepository) {}

  get repository(): MetadataRepository {
    return this.repo;
  }

  nodeCount(): number {
    return this.repo.size();
  }

  edgeCount(): number {
    return this.repo.allNodes().reduce((sum, n) => sum + n.dependencies.size, 0);
  }

  /** adjacency list: node -> dependencies (must deploy before node) */
  toAdjacencyList(): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    for (const node of this.repo.allNodes()) {
      adj.set(node.id, [...node.dependencies]);
    }
    return adj;
  }

  /** reverse adjacency: node -> dependents */
  toReverseAdjacencyList(): Map<string, string[]> {
    const rev = new Map<string, string[]>();
    for (const node of this.repo.allNodes()) {
      rev.set(node.id, [...node.dependents]);
    }
    return rev;
  }

  indegreeMap(): Map<string, number> {
    const map = new Map<string, number>();
    for (const node of this.repo.allNodes()) {
      map.set(node.id, node.indegree);
    }
    return map;
  }
}
