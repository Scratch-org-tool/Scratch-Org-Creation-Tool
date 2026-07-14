import { createMetadataNode, type MetadataNode } from '../types/metadata-node';
import type { EdgeMeta } from '../types/checkpoint';
import type { DependencySource } from '../types/deployment-state';

export class MetadataRepository {
  private readonly nodes = new Map<string, MetadataNode>();
  private readonly learnedEdges: EdgeMeta[] = [];

  addNode(node: MetadataNode): void {
    this.nodes.set(node.id, node);
  }

  getNode(id: string): MetadataNode | undefined {
    return this.nodes.get(id);
  }

  getOrCreate(
    metadataType: string,
    apiName: string,
    overrides?: Partial<Pick<MetadataNode, 'filePath' | 'requiresSourceExpansion'>>,
  ): MetadataNode {
    const id = `${metadataType}:${apiName}`;
    const existing = this.nodes.get(id);
    if (existing) {
      if (overrides?.filePath && !existing.filePath) existing.filePath = overrides.filePath;
      return existing;
    }
    const node = createMetadataNode(metadataType, apiName, overrides);
    this.nodes.set(id, node);
    return node;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  allNodes(): MetadataNode[] {
    return [...this.nodes.values()];
  }

  size(): number {
    return this.nodes.size;
  }

  addEdge(fromId: string, toId: string, source: DependencySource, confidence = 1): boolean {
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);
    if (!from || !to || fromId === toId) return false;
    if (from.dependencies.has(toId)) return false;

    from.dependencies.add(toId);
    from.outdegree = from.dependencies.size;
    to.dependents.add(fromId);
    to.indegree = to.dependents.size;
    if (!from.discoveredBy.includes(source)) from.discoveredBy.push(source);
    return true;
  }

  addLearnedEdge(fromId: string, toId: string, confidence = 0.9): void {
    if (this.addEdge(fromId, toId, 'learned', confidence)) {
      this.learnedEdges.push({ from: fromId, to: toId, source: 'learned', confidence });
    }
  }

  getLearnedEdges(): EdgeMeta[] {
    return [...this.learnedEdges];
  }

  applyLearnedEdges(edges: EdgeMeta[]): void {
    for (const edge of edges) {
      this.addLearnedEdge(edge.from, edge.to, edge.confidence);
    }
  }

  nodesByState(state: MetadataNode['deploymentState']): MetadataNode[] {
    return this.allNodes().filter((n) => n.deploymentState === state);
  }

  readyNodes(): MetadataNode[] {
    return this.allNodes().filter(
      (n) =>
        n.deploymentState === 'READY' ||
        (n.deploymentState === 'DISCOVERED' && n.indegree === 0),
    );
  }

  markDeployed(id: string, batchNumber: number, durationMs: number): void {
    const node = this.nodes.get(id);
    if (!node) return;
    node.deploymentState = 'DEPLOYED';
    node.batchNumber = batchNumber;
    node.deploymentDurationMs = durationMs;
  }

  markFailed(id: string, error: MetadataNode['lastError']): void {
    const node = this.nodes.get(id);
    if (!node) return;
    node.deploymentState = 'FAILED';
    node.lastError = error;
    node.retryCount += 1;
  }

  markReady(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;
    if (node.deploymentState === 'DISCOVERED' || node.deploymentState === 'FAILED') {
      node.deploymentState = 'READY';
    }
  }

  decrementIndegreeForDependents(deployedId: string): string[] {
    const newlyReady: string[] = [];
    const deployed = this.nodes.get(deployedId);
    if (!deployed) return newlyReady;

    for (const depId of deployed.dependents) {
      const dep = this.nodes.get(depId);
      if (!dep) continue;
      dep.indegree = Math.max(0, dep.indegree - 1);
      if (dep.indegree === 0 && (dep.deploymentState === 'DISCOVERED' || dep.deploymentState === 'WAITING')) {
        dep.deploymentState = 'READY';
        newlyReady.push(depId);
      }
    }
    return newlyReady;
  }

  snapshot(): Map<string, MetadataNode> {
    return new Map(this.nodes);
  }
}
