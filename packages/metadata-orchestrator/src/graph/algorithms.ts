/** Tarjan's algorithm for strongly connected components */
export function tarjanScc(adjacency: Map<string, string[]>): string[][] {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const sccs: string[][] = [];

  const nodes = [...adjacency.keys()];
  for (const n of nodes) {
    if (!indices.has(n)) strongConnect(n);
  }

  function strongConnect(v: string): void {
    indices.set(v, index);
    lowlink.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) ?? []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) sccs.push(component);
    }
  }

  return sccs;
}

function insertSorted(queue: string[], node: string, compareFn: (a: string, b: string) => number): void {
  let lo = 0;
  let hi = queue.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compareFn(queue[mid], node) <= 0) lo = mid + 1;
    else hi = mid;
  }
  queue.splice(lo, 0, node);
}

/** Kahn topological sort with optional priority ordering among ready nodes */
export function kahnTopologicalSort(
  nodes: string[],
  adjacency: Map<string, string[]>,
  compareFn?: (a: string, b: string) => number,
): string[] | null {
  const compare = compareFn ?? ((a, b) => a.localeCompare(b));
  const indegree = new Map<string, number>();
  for (const n of nodes) indegree.set(n, 0);
  for (const [from, deps] of adjacency) {
    for (const dep of deps) {
      indegree.set(from, (indegree.get(from) ?? 0));
      indegree.set(dep, (indegree.get(dep) ?? 0));
    }
  }
  for (const [from, deps] of adjacency) {
    indegree.set(from, deps.length);
  }

  const queue: string[] = [];
  for (const n of nodes) {
    if ((indegree.get(n) ?? 0) === 0) insertSorted(queue, n, compare);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    sorted.push(n);
    for (const [from, deps] of adjacency) {
      if (deps.includes(n)) {
        const d = (indegree.get(from) ?? 1) - 1;
        indegree.set(from, d);
        if (d === 0) insertSorted(queue, from, compare);
      }
    }
  }

  return sorted.length === nodes.length ? sorted : null;
}

export function condenseScc(
  sccs: string[][],
  priorityFn: (nodeId: string) => number,
): Map<string, number> {
  const order = new Map<string, number>();
  const sorted = [...sccs].sort((a, b) => {
    const pa = Math.min(...a.map(priorityFn));
    const pb = Math.min(...b.map(priorityFn));
    return pa - pb;
  });
  sorted.forEach((component, idx) => {
    for (const id of component) order.set(id, idx);
  });
  return order;
}
