'use client';

import { useCallback, useEffect, useState } from 'react';
import { ListRow, ListRowGroup, StatusBadge } from '@/components/studio';
import { api } from '@/services/api';

export interface DataDeployBatchChunk {
  id: string;
  chunkIndex: number;
  status: string;
  recordCount: number | null;
  error: string | null;
  jobId: string | null;
}

export interface DataDeployBatch {
  id: string;
  status: string;
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  totalRecords: number;
  chunkSize: number;
  objectName: string | null;
  strategy: string;
  chunks: DataDeployBatchChunk[];
}

interface DataDeployBatchProgressProps {
  batchId: string;
  onTerminal?: (batch: DataDeployBatch) => void;
}

const TERMINAL = ['completed', 'failed', 'cancelled'];

export function DataDeployBatchProgress({ batchId, onTerminal }: DataDeployBatchProgressProps) {
  const [batch, setBatch] = useState<DataDeployBatch | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<DataDeployBatch>(`/data/batches/${batchId}`);
      setBatch(data);
      if (TERMINAL.includes(data.status)) {
        onTerminal?.(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [batchId, onTerminal]);

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 2000);
    return () => clearInterval(poll);
  }, [load]);

  if (!batch) return null;

  const progressLabel = `${batch.completedChunks + batch.failedChunks}/${batch.totalChunks} chunks`;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Load-balanced deploy</p>
          <p className="text-xs text-muted-foreground">
            {progressLabel} · {batch.totalRecords.toLocaleString()} records · chunks of{' '}
            {batch.chunkSize.toLocaleString()}
          </p>
        </div>
        <StatusBadge status={batch.status} />
      </div>
      <ListRowGroup>
        {batch.chunks.map((chunk) => (
          <ListRow
            key={chunk.id}
            title={`Chunk ${chunk.chunkIndex + 1}`}
            subtitle={
              chunk.recordCount != null
                ? `${chunk.recordCount.toLocaleString()} records`
                : chunk.error ?? undefined
            }
            trailing={<StatusBadge status={chunk.status} />}
          />
        ))}
      </ListRowGroup>
    </div>
  );
}
