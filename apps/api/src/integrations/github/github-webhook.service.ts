import {
  BadRequestException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { GitHubIntegrationService } from './github-integration.service';
import { githubIssueId } from './github.types';
import { GitHubWorkItemAdapter } from './github-work-item.adapter';

interface GitHubWebhookPayload {
  action?: string;
  installation?: { id?: number };
  repository?: { full_name?: string };
  issue?: {
    id?: number;
    number?: number;
    state?: string;
    updated_at?: string;
  };
  projects_v2_item?: {
    id?: number;
    node_id?: string;
    project_node_id?: string;
    content_node_id?: string;
    content_type?: string;
    updated_at?: string;
  };
}

export function verifyGitHubWebhookSignature(
  body: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const suppliedHex = signatureHeader.slice('sha256='.length);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  const supplied = Buffer.from(suppliedHex, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

@Injectable()
export class GitHubWebhookService {
  constructor(
    private readonly integration: GitHubIntegrationService,
    @Optional() private readonly workItems?: GitHubWorkItemAdapter,
  ) {}

  async receive(input: {
    rawBody: Buffer;
    signature?: string;
    deliveryId?: string;
    eventType?: string;
  }): Promise<{ accepted: true; duplicate: boolean; deliveryId: string }> {
    if (!input.deliveryId || !/^[A-Za-z0-9_.:-]{1,200}$/.test(input.deliveryId)) {
      throw new BadRequestException('Missing or invalid X-GitHub-Delivery header');
    }
    if (!input.eventType || !/^[A-Za-z0-9_.-]{1,100}$/.test(input.eventType)) {
      throw new BadRequestException('Missing or invalid X-GitHub-Event header');
    }
    let payload: GitHubWebhookPayload;
    try {
      payload = JSON.parse(input.rawBody.toString('utf8')) as GitHubWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid GitHub webhook JSON');
    }
    const installationId = payload.installation?.id;
    if (!installationId) throw new BadRequestException('Webhook installation id is required');
    const connection = await prisma.workItemConnection.findFirst({
      where: {
        provider: 'github_issues',
        externalAccountId: String(installationId),
        status: { in: ['connected', 'degraded'] },
      },
    });
    if (!connection) throw new UnauthorizedException('Unknown GitHub installation');
    const credentials = await this.integration.getWorkItemCredentials(connection.id);
    if (
      !credentials?.webhookSecret ||
      !verifyGitHubWebhookSignature(input.rawBody, input.signature, credentials.webhookSecret)
    ) {
      throw new UnauthorizedException('Invalid GitHub webhook signature');
    }

    const payloadHash = createHash('sha256').update(input.rawBody).digest('hex');
    const idempotencyKey = `github:${input.deliveryId}`;
    let delivery: {
      id: string;
      status: string;
      payloadHash: string;
    };
    let duplicate = false;
    try {
      delivery = await prisma.webhookDelivery.create({
        data: {
          idempotencyKey,
          provider: 'github',
          externalDeliveryId: input.deliveryId,
          eventType: input.eventType,
          payloadHash,
          workItemConnectionId: connection.id,
          status: 'received',
        },
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      duplicate = true;
      const existing = await prisma.webhookDelivery.findUnique({
        where: { idempotencyKey },
      });
      if (!existing || existing.payloadHash !== payloadHash) {
        throw new BadRequestException('GitHub delivery id was reused with different content');
      }
      if (existing.status === 'processed' || existing.status === 'processing') {
        return { accepted: true, duplicate: true, deliveryId: input.deliveryId };
      }
      delivery = existing;
    }

    const claimed = await prisma.webhookDelivery.updateMany({
      where: {
        id: delivery.id,
        status: { in: ['received', 'failed'] },
      },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
        error: null,
      },
    });
    if (claimed.count === 0) {
      return { accepted: true, duplicate: true, deliveryId: input.deliveryId };
    }

    try {
      await this.refreshSnapshot(connection.id, input.eventType, payload);
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'processed', processedAt: new Date(), error: null },
      });
    } catch (error) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          // Error data is bounded and never includes request headers or credential material.
          error: (error instanceof Error ? error.message : 'Webhook processing failed').slice(0, 500),
        },
      });
      throw error;
    }
    return { accepted: true, duplicate, deliveryId: input.deliveryId };
  }

  private async refreshSnapshot(
    connectionId: string,
    eventType: string,
    payload: GitHubWebhookPayload,
  ): Promise<void> {
    if (payload.issue?.number && payload.repository?.full_name) {
      const [owner, repo] = payload.repository.full_name.split('/');
      const externalItemId = githubIssueId({
        owner,
        repo,
        number: payload.issue.number,
      });
      const detail = this.workItems
        ? await this.workItems.getWorkItem(
            externalItemId,
            payload.repository.full_name,
            { connectionId },
          )
        : null;
      await prisma.workItemSnapshot.upsert({
        where: {
          workItemConnectionId_externalProjectId_externalItemId: {
            workItemConnectionId: connectionId,
            externalProjectId: payload.repository.full_name,
            externalItemId,
          },
        },
        create: {
          workItemConnectionId: connectionId,
          externalProjectId: payload.repository.full_name,
          externalItemId,
          version: payload.issue.updated_at ?? null,
          state: detail?.state.name ?? payload.issue.state ?? null,
          payload: (detail ?? payload) as object,
          providerUpdatedAt: this.date(payload.issue.updated_at),
        },
        update: {
          version: payload.issue.updated_at ?? null,
          state: detail?.state.name ?? payload.issue.state ?? null,
          payload: (detail ?? payload) as object,
          providerUpdatedAt: this.date(payload.issue.updated_at),
          capturedAt: new Date(),
        },
      });
      return;
    }
    const item = payload.projects_v2_item;
    if (eventType === 'projects_v2_item' && item?.content_node_id && item.project_node_id) {
      await prisma.workItemSnapshot.upsert({
        where: {
          workItemConnectionId_externalProjectId_externalItemId: {
            workItemConnectionId: connectionId,
            externalProjectId: item.project_node_id,
            externalItemId: item.content_node_id,
          },
        },
        create: {
          workItemConnectionId: connectionId,
          externalProjectId: item.project_node_id,
          externalItemId: item.content_node_id,
          version: item.updated_at ?? null,
          payload: payload as object,
          providerUpdatedAt: this.date(item.updated_at),
        },
        update: {
          version: item.updated_at ?? null,
          payload: payload as object,
          providerUpdatedAt: this.date(item.updated_at),
          capturedAt: new Date(),
        },
      });
    }
  }

  private date(value?: string): Date | null {
    return value && Number.isFinite(Date.parse(value)) ? new Date(value) : null;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
