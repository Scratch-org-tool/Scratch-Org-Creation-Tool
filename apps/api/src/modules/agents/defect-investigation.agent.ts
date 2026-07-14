import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import type { AgentResult } from './agent-router.service';
import { AgentRunOptions, COPILOT_CHAT_LLM, knowledgeBlock, tierGuardrails, wantsExecutableAction } from './agent-options';

type DeltaFn = (delta: { reasoning?: string; content?: string }) => void;

@Injectable()
export class DefectInvestigationAgent {
  constructor(private readonly nvidiaService: NvidiaService) {}

  async run(
    query: string,
    context?: Record<string, unknown>,
    options?: AgentRunOptions,
    onDelta?: DeltaFn,
  ): Promise<AgentResult> {
    // Tier filter is mandatory here: restricted users must never receive
    // internal-tier chunks as "evidence".
    const allowedTiers = options?.tiers ?? ['app_guide', 'internal'];
    const knowledge = await prisma.knowledgeChunk.findMany({
      where: {
        tier: { in: allowedTiers },
        OR: [
          { content: { contains: query.split(' ')[0], mode: 'insensitive' } },
          { sourceType: { in: ['apex', 'flow', 'metadata', 'custom_settings'] } },
        ],
      },
      take: 10,
    });

    const contextDocs = knowledge
      .map((k) => `[${k.sourceType}] ${k.source}: ${k.content.substring(0, 500)}`)
      .join('\n\n');

    const messages = [
      {
        role: 'system' as const,
        content: `You are the Defect Investigation Agent. Analyze Salesforce Flows, Apex, Metadata,
and Custom Settings to find root causes. Use retrieved knowledge as evidence. Be concise.${tierGuardrails(options)}${knowledgeBlock(options)}`,
      },
      {
        role: 'user' as const,
        content: `Issue: ${query}\n\nRetrieved knowledge:\n${contextDocs || 'No matching knowledge found.'}\n\nContext: ${JSON.stringify(context ?? {})}`,
      },
    ];

    const result = await this.invokeLlm(messages, options, onDelta);
    const includeAction =
      options?.mode === 'action' || wantsExecutableAction(query);

    return {
      content: result.content,
      reasoning: result.reasoning,
      action: includeAction
        ? { type: 'defect_analysis', query, evidenceCount: knowledge.length }
        : undefined,
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
