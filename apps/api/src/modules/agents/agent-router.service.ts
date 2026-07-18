import { Injectable } from '@nestjs/common';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import { ScratchOrgAgent } from './scratch-org.agent';
import { DataDeploymentAgent } from './data-deployment.agent';
import { DefectInvestigationAgent } from './defect-investigation.agent';
import { ReleaseAgent } from './release.agent';
import { KnowledgeService } from './knowledge.service';
import {
  AgentRunOptions,
  knowledgeBlock,
  tierGuardrails,
  wantsExecutableAction,
} from './agent-options';
import { matchNavigationAction, type AppModule } from '@sfcc/shared';

export interface AgentResult {
  content: string;
  reasoning?: string;
  action?: Record<string, unknown>;
}

type DeltaFn = (delta: { reasoning?: string; content?: string }) => void;

const OPERATOR_SYSTEM_PROMPT = `You are the in-app assistant for **Salesforce DevOps Command Center** — a web application for scratch orgs, metadata deployment, Azure/Jenkins pipelines, SFDMU data jobs, org setup, and job monitoring.

Your job is to help users **operate this application**: where to click in the sidebar, which page to open, what form fields mean, and what happens after each step.

Rules:
- Use the application route map and workflows below as your source of truth. Do not invent pages or features that are not listed.
- Always respect grantedModules in the user context — never suggest pages the user cannot access.
- If the user is already on the correct page (see pathname in context), explain that screen instead of sending them elsewhere.
- Answer format: short and actionable — **where to go**, **what to click**, **what to enter**, **what happens next**.
- Use markdown links to in-app paths, e.g. [Metadata Deployment](/metadata-deployment), when pointing to another section.
- For greetings or vague questions on a specific page, explain what that page does and offer 2–3 relevant next steps.
- If unsure, ask one clarifying question — do not guess.
- Professional tone — no emojis, no filler phrases.
- Do not discuss unrelated topics; redirect to app usage.`;

@Injectable()
export class AgentRouterService {
  constructor(
    private readonly nvidiaService: NvidiaService,
    private readonly knowledgeService: KnowledgeService,
    private readonly scratchOrgAgent: ScratchOrgAgent,
    private readonly dataDeploymentAgent: DataDeploymentAgent,
    private readonly defectInvestigationAgent: DefectInvestigationAgent,
    private readonly releaseAgent: ReleaseAgent,
  ) {}

  async route(
    agentType: string,
    query: string,
    context?: Record<string, unknown>,
    _sessionId?: string,
    options?: AgentRunOptions,
    onDelta?: DeltaFn,
  ): Promise<AgentResult> {
    // Ground every answer with tier-filtered retrieval (RAG). The tier filter
    // runs in the retrieval query, so restricted users' prompts physically
    // never contain internal chunks.
    const grounded: AgentRunOptions = {
      ...options,
      knowledgeContext: await this.retrieveKnowledge(query, options),
    };

    switch (agentType) {
      case 'scratch_org':
        return this.scratchOrgAgent.run(query, context, grounded, onDelta);
      case 'data_deployment':
        return this.dataDeploymentAgent.run(query, context, grounded, onDelta);
      case 'defect_investigation':
        return this.defectInvestigationAgent.run(query, context, grounded, onDelta);
      case 'release':
        return this.releaseAgent.run(query, context, grounded, onDelta);
      default:
        return this.generalChat(query, context, grounded, onDelta);
    }
  }

  private async retrieveKnowledge(
    query: string,
    options?: AgentRunOptions,
  ): Promise<string | undefined> {
    const tiers = options?.tiers ?? ['app_guide', 'internal'];
    try {
      const hits = await this.knowledgeService.search(query, 4, tiers);
      if (hits.length === 0) return undefined;
      return hits
        .map((h) => `--- ${h.source} ---\n${h.content}`)
        .join('\n\n');
    } catch {
      return undefined;
    }
  }

  private async generalChat(
    query: string,
    context?: Record<string, unknown>,
    options?: AgentRunOptions,
    onDelta?: DeltaFn,
  ): Promise<AgentResult> {
    const guideBlock = options?.guideContext
      ? `\n\n---\n${options.guideContext}\n---`
      : '';

    const contextBlock = context
      ? `\n\nUser context (JSON):\n${JSON.stringify(context, null, 2)}`
      : '';

    const systemContent = `${OPERATOR_SYSTEM_PROMPT}${guideBlock}${tierGuardrails(options)}${knowledgeBlock(options)}`;

    const historyMessages = (options?.history ?? []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const messages = [
      { role: 'system' as const, content: systemContent },
      ...historyMessages,
      {
        role: 'user' as const,
        content: `${query}${contextBlock}`,
      },
    ];

    let result: { content: string; reasoning?: string };
    result = await this.nvidiaService.chatCopilotResilient(messages, onDelta);

    const grantedModules = (context?.grantedModules as AppModule[] | undefined) ?? [];
    const navAction = matchNavigationAction(
      query,
      grantedModules,
      context?.role === 'admin' ? 'admin' : 'user',
    );

    return {
      content: result.content,
      reasoning: result.reasoning,
      action: navAction as Record<string, unknown> | undefined,
    };
  }
}

export { wantsExecutableAction };
