import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { saveAgentSession, getAgentSession } from '@sfcc/firebase';
import type {
  AgentSession,
  CopilotMessage,
  CopilotStreamEvent,
  KnowledgeTier,
} from '@sfcc/shared';
import {
  getEffectiveModules,
  resolveCopilotTiers,
  type UserAccessProfile,
  type AppModule,
} from '@sfcc/shared';
import { AgentRouterService } from '../agents/agent-router.service';
import { KnowledgeService } from '../agents/knowledge.service';
import { wantsExecutableAction } from '../agents/agent-router.service';
import type { AgentRunOptions } from '../agents/agent-options';
import { KNOWLEDGE_CORPUS, KNOWLEDGE_CORPUS_SOURCE_TYPE } from './knowledge-corpus';
import { AppGuideService } from './app-guide.service';

function stripUndefined<T>(value: T): T {
  if (value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

function toCopilotMessage(msg: CopilotMessage): CopilotMessage {
  const cleaned = stripUndefined(msg);
  if (cleaned.reasoning === undefined) {
    const { reasoning: _r, ...rest } = cleaned;
    return rest as CopilotMessage;
  }
  return cleaned;
}

function trimHistory(
  messages: CopilotMessage[],
  maxTurns = 10,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const conversational = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  return conversational.slice(-maxTurns).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
}

export type CopilotStreamWriter = (event: CopilotStreamEvent) => void;

@Injectable()
export class CopilotService {
  constructor(
    private readonly agentRouter: AgentRouterService,
    private readonly knowledgeService: KnowledgeService,
    private readonly appGuideService: AppGuideService,
  ) {}

  async chat(
    body: {
      message: string;
      sessionId?: string;
      agentType?: string;
      context?: Record<string, unknown>;
    },
    userId = 'system',
    userProfile?: UserAccessProfile,
  ) {
    return this.runChat(body, userId, userProfile);
  }

  async chatStream(
    body: {
      message: string;
      sessionId?: string;
      agentType?: string;
      context?: Record<string, unknown>;
    },
    userId: string,
    userProfile: UserAccessProfile | undefined,
    write: CopilotStreamWriter,
  ) {
    try {
      const result = await this.runChat(body, userId, userProfile, (delta) => {
        if (delta.reasoning) write({ type: 'reasoning', content: delta.reasoning });
        if (delta.content) write({ type: 'content', content: delta.content });
      });

      write({
        type: 'done',
        sessionId: result.sessionId,
        agentType: result.agentType,
        message: result.message,
        action: result.action,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Copilot request failed';
      write({ type: 'error', message });
    }
  }

  private mergeContext(
    clientContext: Record<string, unknown> | undefined,
    userProfile?: UserAccessProfile,
  ): Record<string, unknown> {
    const serverModules: AppModule[] = userProfile ? getEffectiveModules(userProfile) : [];
    const clientModules = (clientContext?.grantedModules as AppModule[] | undefined) ?? [];

    return {
      ...(clientContext ?? {}),
      grantedModules: serverModules.length > 0 ? serverModules : clientModules,
      role: userProfile?.role ?? clientContext?.role ?? 'user',
      displayName: userProfile?.displayName ?? clientContext?.displayName,
    };
  }

  private async runChat(
    body: {
      message: string;
      sessionId?: string;
      agentType?: string;
      context?: Record<string, unknown>;
    },
    userId: string,
    userProfile?: UserAccessProfile,
    onDelta?: (delta: { reasoning?: string; content?: string }) => void,
  ) {
    try {
      const sessionId = body.sessionId ?? crypto.randomUUID();
      let session: AgentSession | null = null;

      if (body.sessionId) {
        try {
          session = await getAgentSession(sessionId);
        } catch (err) {
          console.warn('[Copilot] Session load failed (non-blocking):', err instanceof Error ? err.message : err);
        }
        // Session hijack protection: never continue another user's session.
        if (session && session.userId !== userId) {
          session = null;
        }
      }

      if (!session) {
        session = {
          id: sessionId,
          userId,
          agentType: body.agentType ?? 'general',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      const mergedContext = this.mergeContext(body.context, userProfile);
      const guideContext = this.appGuideService.buildGuideContext(body.message, mergedContext);

      const userMessage: CopilotMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: body.message,
        timestamp: new Date().toISOString(),
      };
      session.messages.push(userMessage);

      const history = trimHistory(session.messages.slice(0, -1));
      const agentType = this.detectAgentType(body.message, body.agentType);
      const tiers = resolveCopilotTiers(userProfile);
      const runOptions: AgentRunOptions = {
        mode: 'chat',
        tiers,
        isAdmin: userProfile?.role === 'admin',
        userId,
        history,
        guideContext,
      };

      const result = await this.agentRouter.route(
        agentType,
        body.message,
        mergedContext,
        sessionId,
        runOptions,
        onDelta,
      );

      let action = result.action;
      if (!action && agentType === 'general') {
        const nav = this.appGuideService.detectNavigationAction(
          body.message,
          (mergedContext.grantedModules as AppModule[]) ?? [],
        );
        if (nav) action = nav as Record<string, unknown>;
      }

      const assistantMessage: CopilotMessage = toCopilotMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content || 'I could not generate a response. Please try again.',
        reasoning: result.reasoning,
        timestamp: new Date().toISOString(),
      });
      session.messages.push(assistantMessage);
      session.updatedAt = new Date().toISOString();
      session.agentType = agentType;

      void saveAgentSession(stripUndefined(session) as AgentSession).catch((err) => {
        console.warn('[Copilot] Session save failed (non-blocking):', err instanceof Error ? err.message : err);
      });

      return {
        sessionId,
        message: assistantMessage,
        agentType,
        action,
      };
    } catch (err) {
      console.error('[Copilot] chat failed:', err);
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Copilot request failed',
      );
    }
  }

  async ingestKnowledge(
    source: string,
    sourceType: string,
    content: string,
    tier: KnowledgeTier = 'internal',
  ) {
    return this.knowledgeService.ingest(source, sourceType, content, tier);
  }

  /** Replace the curated app corpus (idempotent — clears previous corpus chunks first). */
  async seedKnowledgeCorpus() {
    const cleared = await this.knowledgeService.clearBySourceType(KNOWLEDGE_CORPUS_SOURCE_TYPE);
    let ingested = 0;
    for (const doc of KNOWLEDGE_CORPUS) {
      await this.knowledgeService.ingest(
        doc.source,
        KNOWLEDGE_CORPUS_SOURCE_TYPE,
        doc.content,
        doc.tier,
      );
      ingested += 1;
    }
    return { cleared, ingested };
  }

  private detectAgentType(message: string, explicit?: string): string {
    if (explicit) return explicit;
    if (!wantsExecutableAction(message)) return 'general';

    const lower = message.toLowerCase();
    if (/\b(scratch\s+org|scratch org)\b/.test(lower)) return 'scratch_org';
    if (/\b(deploy|replicate|sfdmu|onboarding)\b/.test(lower)) return 'data_deployment';
    if (/\b(defect|bug|root cause|investigate)\b/.test(lower)) return 'defect_investigation';
    if (/\b(release|rollback|branch)\b/.test(lower)) return 'release';
    return 'general';
  }
}
