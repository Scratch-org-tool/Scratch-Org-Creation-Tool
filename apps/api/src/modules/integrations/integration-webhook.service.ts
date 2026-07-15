import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { prisma, type Prisma } from '@sfcc/db';
import { AtlassianConnectionStore } from '../../integrations/atlassian/atlassian-connection.store';
import { JiraWorkItemAdapter } from '../../integrations/jira/jira.adapter';

export interface WebhookRequest {
  provider: string;
  connectionId: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
  payload: unknown;
}

@Injectable()
export class IntegrationWebhookService {
  constructor(
    private readonly store: AtlassianConnectionStore,
    private readonly jira: JiraWorkItemAdapter,
  ) {}

  async receive(input: WebhookRequest) {
    const secret = await this.webhookSecret(input.provider, input.connectionId);
    this.verifySignature(input.headers, input.rawBody, secret);
    const payloadHash = createHash('sha256').update(input.rawBody).digest('hex');
    const eventType =
      this.header(input.headers, 'x-event-key') ??
      this.header(input.headers, 'x-atlassian-webhook-flow') ??
      this.payloadEvent(input.payload) ??
      'unknown';
    const externalDeliveryId =
      this.header(input.headers, 'x-request-uuid') ??
      this.header(input.headers, 'x-atlassian-webhook-identifier') ??
      this.header(input.headers, 'x-webhook-identifier') ??
      `${eventType}:${payloadHash}`;
    const idempotencyKey = `${input.provider}:${input.connectionId}:${externalDeliveryId}`;
    let delivery;
    try {
      delivery = await prisma.webhookDelivery.create({
        data: {
          idempotencyKey,
          provider: input.provider,
          externalDeliveryId,
          eventType,
          payloadHash,
          scmConnectionId: input.provider === 'bitbucket' ? input.connectionId : null,
          workItemConnectionId: input.provider === 'jira' ? input.connectionId : null,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return { accepted: true, duplicate: true, deliveryId: externalDeliveryId };
      }
      throw error;
    }

    try {
      if (input.provider === 'jira') await this.refreshJiraSnapshot(input.connectionId, input.payload);
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'processed',
          attempts: { increment: 1 },
          processedAt: new Date(),
          error: null,
        },
      });
      return { accepted: true, duplicate: false, deliveryId: externalDeliveryId };
    } catch (error) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          error: (error instanceof Error ? error.message : 'Snapshot refresh failed').slice(0, 1_000),
        },
      });
      throw error;
    }
  }

  private async webhookSecret(provider: string, connectionId: string): Promise<string> {
    if (provider === 'bitbucket') {
      const connection = await this.store.getBitbucket(connectionId);
      if (!connection) throw new NotFoundException('Bitbucket webhook connection not found');
      if (!connection.config.webhookSecret) {
        throw new UnauthorizedException('Bitbucket webhook secret is not configured');
      }
      return connection.config.webhookSecret;
    }
    if (provider === 'jira') {
      const connection = await this.store.getJira(connectionId);
      if (!connection) throw new NotFoundException('Jira webhook connection not found');
      if (!connection.config.webhookSecret) {
        throw new UnauthorizedException('Jira webhook secret is not configured');
      }
      return connection.config.webhookSecret;
    }
    throw new NotFoundException(`Webhook provider "${provider}" is not supported`);
  }

  private verifySignature(
    headers: Record<string, string | string[] | undefined>,
    body: Buffer,
    secret: string,
  ): void {
    const signature =
      this.header(headers, 'x-hub-signature-256') ??
      this.header(headers, 'x-hub-signature');
    if (signature) {
      const [algorithm, digest] = signature.includes('=')
        ? signature.split('=', 2)
        : ['sha256', signature];
      if (algorithm !== 'sha256' || !digest) throw new UnauthorizedException('Invalid webhook signature');
      const expected = createHmac('sha256', secret).update(body).digest('hex');
      if (!this.safeEqual(digest, expected)) throw new UnauthorizedException('Invalid webhook signature');
      return;
    }
    const authorization = this.header(headers, 'authorization');
    if (authorization?.startsWith('JWT ')) {
      this.verifyJwt(authorization.slice(4), secret);
      return;
    }
    const sharedSecret = this.header(headers, 'x-webhook-secret');
    if (sharedSecret && this.safeEqual(sharedSecret, secret)) return;
    throw new UnauthorizedException('Missing webhook signature');
  }

  private verifyJwt(token: string, secret: string): void {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid webhook JWT');
    }
    let header: { alg?: string };
    let payload: { exp?: number; nbf?: number };
    try {
      header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as { alg?: string };
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
        exp?: number;
        nbf?: number;
      };
    } catch {
      throw new UnauthorizedException('Invalid webhook JWT');
    }
    if (header.alg !== 'HS256') throw new UnauthorizedException('Unsupported webhook JWT algorithm');
    const expected = createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    if (!this.safeEqual(signature, expected)) throw new UnauthorizedException('Invalid webhook JWT');
    const now = Math.floor(Date.now() / 1_000);
    if (payload.exp !== undefined && payload.exp < now - 30) {
      throw new UnauthorizedException('Expired webhook JWT');
    }
    if (payload.nbf !== undefined && payload.nbf > now + 30) {
      throw new UnauthorizedException('Webhook JWT is not active');
    }
  }

  private async refreshJiraSnapshot(connectionId: string, payload: unknown): Promise<void> {
    const record = payload && typeof payload === 'object'
      ? payload as Record<string, unknown>
      : {};
    const issue = record.issue && typeof record.issue === 'object'
      ? record.issue as Record<string, unknown>
      : {};
    const key = typeof issue.key === 'string' ? issue.key : null;
    if (!key) return;
    const projectKey = key.includes('-') ? key.slice(0, key.lastIndexOf('-')) : '';
    const detail = await this.jira.getWorkItemForConnection(key, projectKey, connectionId);
    await prisma.workItemSnapshot.upsert({
      where: {
        workItemConnectionId_externalProjectId_externalItemId: {
          workItemConnectionId: connectionId,
          externalProjectId: projectKey,
          externalItemId: key,
        },
      },
      create: {
        workItemConnectionId: connectionId,
        externalProjectId: projectKey,
        externalItemId: key,
        version: typeof record.timestamp === 'number' ? String(record.timestamp) : null,
        state: detail.state.name,
        payload: JSON.parse(JSON.stringify(detail)) as Prisma.InputJsonValue,
        providerUpdatedAt: this.date(detail.updatedAt),
      },
      update: {
        version: typeof record.timestamp === 'number' ? String(record.timestamp) : null,
        state: detail.state.name,
        payload: JSON.parse(JSON.stringify(detail)) as Prisma.InputJsonValue,
        providerUpdatedAt: this.date(detail.updatedAt),
        capturedAt: new Date(),
      },
    });
  }

  private date(value: string): Date | null {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private payloadEvent(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const value = (payload as Record<string, unknown>).webhookEvent;
    return typeof value === 'string' ? value : null;
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | null {
    const direct = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(direct)) return direct[0] ?? null;
    if (direct) return direct;
    const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
    const value = key ? headers[key] : undefined;
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2002');
  }
}
