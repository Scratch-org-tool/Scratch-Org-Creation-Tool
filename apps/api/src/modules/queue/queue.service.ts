import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type Job as BullJob, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, QUEUE_CONFIG } from '@sfcc/shared';

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    maxRetriesPerRequest: null,
  };
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private connectionOptions: ConnectionOptions;
  private connection: IORedis;
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();

  constructor() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.connectionOptions = parseRedisUrl(redisUrl);
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }

  onModuleInit() {
    // Workers registered by WorkerRegistry
  }

  async onModuleDestroy() {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    await this.connection.quit();
  }

  getConnection(): IORedis {
    return this.connection;
  }

  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const config = QUEUE_CONFIG[name as keyof typeof QUEUE_CONFIG];
      this.queues.set(
        name,
        new Queue(name, {
          connection: this.connectionOptions,
          defaultJobOptions: {
            attempts: config?.attempts ?? 3,
            backoff: { type: 'exponential', delay: config?.backoff ?? 3000 },
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        }),
      );
    }
    return this.queues.get(name)!;
  }

  async addJob<T extends Record<string, unknown>>(
    queueName: string,
    jobType: string,
    payload: T,
    jobId?: string,
    options?: { attempts?: number },
  ): Promise<string> {
    const queue = this.getQueue(queueName);
    const config = QUEUE_CONFIG[queueName as keyof typeof QUEUE_CONFIG];
    const pipelineJob = Boolean((payload as { automationRunId?: string }).automationRunId);
    const attempts = options?.attempts ?? (pipelineJob ? 1 : config?.attempts ?? 3);
    const job = await queue.add(jobType, payload, {
      jobId,
      attempts,
      backoff: { type: 'exponential', delay: config?.backoff ?? 3000 },
    });
    return job.id!;
  }

  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) return false;
    await job.remove();
    return true;
  }

  registerWorker(
    queueName: string,
    processor: (job: BullJob) => Promise<unknown>,
  ): Worker {
    const config = QUEUE_CONFIG[queueName as keyof typeof QUEUE_CONFIG];
    const worker = new Worker(queueName, processor, {
      connection: this.connectionOptions,
      concurrency: config?.concurrency ?? 2,
      lockDuration: 'lockDuration' in (config ?? {}) ? (config as { lockDuration?: number }).lockDuration : 30_000,
      stalledInterval: 'stalledInterval' in (config ?? {}) ? (config as { stalledInterval?: number }).stalledInterval : 30_000,
    });
    this.workers.set(queueName, worker);
    return worker;
  }

  getAllQueueNames(): string[] {
    return Object.values(QUEUE_NAMES);
  }
}
