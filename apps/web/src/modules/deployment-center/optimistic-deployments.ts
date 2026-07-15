export type OptimisticDeployment<T extends { id: string; status: string }> = T & {
  approvalPending?: boolean;
};

export function applyApprovalPending<T extends { id: string; status: string }>(
  deployments: readonly T[],
  id: string,
): OptimisticDeployment<T>[] {
  return deployments.map((deployment) => deployment.id === id
    ? { ...deployment, status: 'queued', approvalPending: true }
    : deployment);
}

export function reconcileApproval<T extends { id: string; status: string }>(
  deployments: readonly OptimisticDeployment<T>[],
  id: string,
  serverDeployment: T,
): OptimisticDeployment<T>[] {
  return deployments.map((deployment) => deployment.id === id ? serverDeployment : deployment);
}

export function rollbackApproval<T extends { id: string; status: string }>(
  deployments: readonly OptimisticDeployment<T>[],
  snapshot: T,
): OptimisticDeployment<T>[] {
  return deployments.map((deployment) => deployment.id === snapshot.id ? snapshot : deployment);
}

export type ApprovalFailureDisposition = 'rolled_back' | 'reconciled' | 'ambiguous';

export function reconcileApprovalFailure<T extends { id: string; status: string }>(
  optimistic: readonly OptimisticDeployment<T>[],
  id: string,
  authoritative: readonly T[] | null,
): {
  deployments: OptimisticDeployment<T>[];
  disposition: ApprovalFailureDisposition;
} {
  if (!authoritative) {
    return { deployments: [...optimistic], disposition: 'ambiguous' };
  }
  const deployment = authoritative.find((item) => item.id === id);
  const deployments = deployment
    ? optimistic.map((item) => item.id === id ? deployment : item)
    : [...optimistic];
  return {
    deployments,
    disposition: deployment?.status === 'pending' ? 'rolled_back' : 'reconciled',
  };
}
