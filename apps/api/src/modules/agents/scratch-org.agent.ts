import { Injectable } from '@nestjs/common';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import type { AgentResult } from './agent-router.service';
import { AgentRunOptions, COPILOT_CHAT_LLM, knowledgeBlock, tierGuardrails, wantsExecutableAction } from './agent-options';

type DeltaFn = (delta: { reasoning?: string; content?: string }) => void;

@Injectable()
export class ScratchOrgAgent {
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
        content: `You are the Scratch Org Agent for Salesforce DevOps Command Center.
Help users plan scratch org creation: alias, duration, dev hub, templates, packages.
Guide users to **Environment → Create Scratch Org** (/environment-center/create-scratch-org) for the wizard.
Be concise. Only output JSON action blocks when the user asks to create/provision an org.${tierGuardrails(options)}${knowledgeBlock(options)}`,
      },
      {
        role: 'user' as const,
        content: context ? `${query}\n\nContext: ${JSON.stringify(context)}` : query,
      },
    ];

    const result = await this.invokeLlm(messages, options, onDelta);
    const includeAction =
      options?.mode === 'action' || wantsExecutableAction(query);

    const action = includeAction
      ? this.extractAction(result.content) ?? {
          type: 'scratch_org_workflow',
          config: this.inferConfig(query, context),
        }
      : undefined;

    return {
      content: result.content,
      reasoning: result.reasoning,
      action,
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

  private inferConfig(query: string, context?: Record<string, unknown>) {
    const aliasMatch = query.match(/(?:alias|org)\s+["']?(\w+)/i);
    return {
      alias: aliasMatch?.[1] ?? `scratch-${Date.now()}`,
      duration: 30,
      devHubAlias: context?.devHubAlias ?? 'NE-DEVHUB',
      template: 'config/project-scratch-def.json',
    };
  }

  private extractAction(content: string): Record<string, unknown> | undefined {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]!) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
