import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { NvidiaService } from '../integrations/nvidia/nvidia.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { StreamService } from '../modules/stream/stream.service';
import { AgentRouterService } from '../modules/agents/agent-router.service';

@Injectable()
export class AiAnalysisWorker {
  constructor(
    private readonly nvidiaService: NvidiaService,
    private readonly agentRouter: AgentRouterService,
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
  ) {}

  async process(job: Job) {
    const { agentType, query, context, sessionId, dbJobId } = job.data as {
      agentType: string;
      query: string;
      context?: Record<string, unknown>;
      sessionId?: string;
      dbJobId: string;
    };

    const log = async (stream: 'stdout' | 'stderr', line: string) => {
      await this.jobsService.addLog(dbJobId, stream, line);
      await this.streamService.publishJobLog(dbJobId, stream, line);
    };

    await log('stdout', `AI analysis started: ${agentType}`);

    const result = await this.agentRouter.route(agentType, query, context, sessionId);

    if (result.reasoning) {
      await this.streamService.publish('copilot_chunk', {
        sessionId,
        type: 'reasoning',
        content: result.reasoning,
      });
    }

    await this.streamService.publish('copilot_chunk', {
      sessionId,
      type: 'content',
      content: result.content,
    });

    await log('stdout', result.content.substring(0, 500));
    return result;
  }
}
