import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import type { AgentResult } from './agent-router.service';
import { AgentRunOptions, COPILOT_CHAT_LLM, knowledgeBlock, tierGuardrails, wantsExecutableAction } from './agent-options';

type DeltaFn = (delta: { reasoning?: string; content?: string }) => void;

@Injectable()
export class DataDeploymentAgent {
  constructor(private readonly nvidiaService: NvidiaService) {}

  async run(
    query: string,
    context?: Record<string, unknown>,
    options?: AgentRunOptions,
    onDelta?: DeltaFn,
  ): Promise<AgentResult> {
    const messages = [
      {
        role: 'system' as const,
        content: `You are the Data Deployment Agent for Salesforce DevOps Command Center.
Help with SOQL, SFDMU, org-to-org deploys, and cfs_ob__Onboarding_Config__c replication.
Be concise — bullets and short steps unless the user asks for detail.${tierGuardrails(options)}${knowledgeBlock(options)}`,
      },
      { role: 'user' as const, content: query },
    ];

    const result = await this.invokeLlm(messages, options, onDelta);

    const includeAction =
      options?.mode === 'action' || wantsExecutableAction(query);

    return {
      content: result.content,
      reasoning: result.reasoning,
      action: includeAction
        ? {
            type: 'data_replication',
            soql: this.buildSoql(query),
            objectName: 'cfs_ob__Onboarding_Config__c',
            ...context,
          }
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
      : {
          messages,
          stream: true,
          enableThinking: true,
          maxTokens: 2048,
        };

    if (onDelta) {
      return this.nvidiaService.chatStream({ ...llmOptions, stream: true }, onDelta);
    }
    return this.nvidiaService.chat(llmOptions);
  }

  private buildSoql(query: string): string {
    if (query.toLowerCase().includes('onboarding')) {
      return 'SELECT Id, Name, cfs_ob__Status__c, RecordTypeId FROM cfs_ob__Onboarding_Config__c LIMIT 200';
    }
    return 'SELECT Id, Name FROM Account LIMIT 200';
  }
}
