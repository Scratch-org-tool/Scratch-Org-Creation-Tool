import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import type { AgentResult } from './agent-router.service';
import { AgentRunOptions, COPILOT_CHAT_LLM, knowledgeBlock, tierGuardrails, wantsExecutableAction } from './agent-options';

type DeltaFn = (delta: { reasoning?: string; content?: string }) => void;

@Injectable()
export class ReleaseAgent {
  constructor(private readonly nvidiaService: NvidiaService) {}

  async run(
    query: string,
    context?: Record<string, unknown>,
    options?: AgentRunOptions,
    onDelta?: DeltaFn,
  ): Promise<AgentResult> {
    // Deployment context is scoped to the requesting user (admins see all).
    const recentDeployments = await prisma.deployment.findMany({
      where: options?.isAdmin || !options?.userId ? {} : { createdBy: options.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { targetOrg: true },
    });

    const deploymentSummary = recentDeployments
      .map((d) => `- ${d.repo}/${d.branch} -> ${d.targetOrg.alias} [${d.status}]`)
      .join('\n');

    const messages = [
      {
        role: 'system' as const,
        content: `You are the Release Agent. Analyze branches, metadata, dependencies, and deployment risks.
Provide concise risk assessment and recommendations.${tierGuardrails(options)}${knowledgeBlock(options)}`,
      },
      {
        role: 'user' as const,
        content: `Request: ${query}\n\nRecent deployments:\n${deploymentSummary || 'None'}\n\nContext: ${JSON.stringify(context ?? {})}`,
      },
    ];

    const result = await this.invokeLlm(messages, options, onDelta);
    const includeAction =
      options?.mode === 'action' || wantsExecutableAction(query);

    return {
      content: result.content,
      reasoning: result.reasoning,
      action: includeAction ? { type: 'release_analysis', query } : undefined,
    };
  }

  private async invokeLlm(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options?: AgentRunOptions,
    onDelta?: DeltaFn,
  ) {
    const fast = options?.mode !== 'action';
    const llmOptions = fast
      ? { ...COPILOT_CHAT_LLM, messages, stream: Boolean(onDelta) }
      : { messages, stream: true, enableThinking: true, maxTokens: 2048 };

    if (onDelta) {
      return this.nvidiaService.chatStream({ ...llmOptions, stream: true }, onDelta);
    }
    return this.nvidiaService.chat(llmOptions);
  }
}
