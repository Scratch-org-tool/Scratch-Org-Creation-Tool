import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { prisma, type Prisma } from '@sfcc/db';
import { AtlassianConnectionStore } from '../../integrations/atlassian/atlassian-connection.store';
import { JiraWorkItemAdapter } from '../../integrations/jira/jira.adapter';
import type {
  BitbucketConnectionConfig,
  JiraConnectionConfig,
} from '../../integrations/atlassian/atlassian.types';

export interface WebhookRequest {
  provider: string;
  connectionId: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
  payload: unknown;
  method: string;
  path: string;
  query: string;
}

type WebhookConfig = Pick<
  BitbucketConnectionConfig | JiraConnectionConfig,
  'webhookSecret' | 'webhookIssuer' | 'webhookAudience'
>;

@Injectable()
export class IntegrationWebhookService {
  constructor(
    private readonly store: AtlassianConnectionStore,
    private readonly jira: JiraWorkItemAdapter,
  ) {}

  async receive(input: WebhookRequest) {
    const config = await this.webhookConfig(input.provider, input.connectionId);
    this.verifySignature(input, config);
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
    const connectionScope =
      input.provider === 'bitbucket'
        ? `scm:${input.connectionId}`
        : `work:${input.connectionId}`;
    let delivery;
    try {
      delivery = await prisma.webhookDelivery.create({
        data: {
          idempotencyKey,
          connectionScope,
          provider: input.provider,
          externalDeliveryId,
          eventType,
          payloadHash,
          scmConnectionId: input.provider === 'bitbucket' ? input.connectionId : null,
          workItemConnectionId: input.provider === 'jira' ? input.connectionId : null,
        },
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      delivery = await prisma.webhookDelivery.findUnique({ where: { idempotencyKey } });
      if (
        !delivery ||
        delivery.provider !== input.provider ||
        delivery.connectionScope !== connectionScope ||
        delivery.externalDeliveryId !== externalDeliveryId ||
        delivery.payloadHash !== payloadHash ||
        delivery.scmConnectionId !== (input.provider === 'bitbucket' ? input.connectionId : null) ||
        delivery.workItemConnectionId !== (input.provider === 'jira' ? input.connectionId : null)
      ) {
        throw new ConflictException('Webhook delivery ID was reused with different content or scope');
      }
      if (!['received', 'failed'].includes(delivery.status)) {
        return { accepted: true, duplicate: true, deliveryId: externalDeliveryId };
      }
    }

    const claimed = await prisma.webhookDelivery.updateMany({
      where: {
        id: delivery.id,
        status: { in: ['received', 'failed'] },
        payloadHash,
        connectionScope,
      },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
        error: null,
      },
    });
    if (claimed.count !== 1) {
      return { accepted: true, duplicate: true, deliveryId: externalDeliveryId };
    }

    try {
      if (input.provider === 'jira') await this.refreshJiraSnapshot(input.connectionId, input.payload);
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'processed',
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
          error: (error instanceof Error ? error.message : 'Snapshot refresh failed').slice(0, 1_000),
        },
      });
      throw error;
    }
  }

  private async webhookConfig(provider: string, connectionId: string): Promise<WebhookConfig> {
    if (provider === 'bitbucket') {
      const connection = await this.store.getBitbucket(connectionId);
      if (!connection) throw new NotFoundException('Bitbucket webhook connection not found');
      if (!connection.config.webhookSecret) {
        throw new UnauthorizedException('Bitbucket webhook secret is not configured');
      }
      return connection.config;
    }
    if (provider === 'jira') {
      const connection = await this.store.getJira(connectionId);
      if (!connection) throw new NotFoundException('Jira webhook connection not found');
      if (!connection.config.webhookSecret) {
        throw new UnauthorizedException('Jira webhook secret is not configured');
      }
      return connection.config;
    }
    throw new NotFoundException(`Webhook provider "${provider}" is not supported`);
  }

  private verifySignature(input: WebhookRequest, config: WebhookConfig): void {
    const { headers, rawBody: body } = input;
    const secret = config.webhookSecret!;
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
    if (input.provider === 'bitbucket') {
      throw new UnauthorizedException('Bitbucket webhooks require a raw-body HMAC signature');
    }
    const authorization = this.header(headers, 'authorization');
    if (authorization?.startsWith('JWT ')) {
      this.verifyJwt(authorization.slice(4), secret, input, config);
      return;
    }
    throw new UnauthorizedException('Missing webhook signature');
  }

  private verifyJwt(
    token: string,
    secret: string,
    request: WebhookRequest,
    config: WebhookConfig,
  ): void {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid webhook JWT');
    }
    let header: { alg?: string };
    let payload: {
      exp?: number;
      iat?: number;
      nbf?: number;
      iss?: string;
      aud?: string | string[];
      qsh?: string;
      bodyHash?: string;
      body_hash?: string;
    };
    try {
      header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as { alg?: string };
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
        exp?: number;
        iat?: number;
        nbf?: number;
        iss?: string;
        aud?: string | string[];
        qsh?: string;
        bodyHash?: string;
        body_hash?: string;
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
    if (!Number.isInteger(payload.exp) || !Number.isInteger(payload.iat)) {
      throw new UnauthorizedException('Webhook JWT requires exp and iat');
    }
    if (payload.exp! < now - 30) {
      throw new UnauthorizedException('Expired webhook JWT');
    }
    if (
      payload.iat! > now + 30 ||
      payload.iat! < now - 330 ||
      payload.exp! > now + 300 ||
      payload.exp! - payload.iat! > 300
    ) {
      throw new UnauthorizedException('Webhook JWT lifetime is invalid');
    }
    if (payload.nbf !== undefined && payload.nbf > now + 30) {
      throw new UnauthorizedException('Webhook JWT is not active');
    }
    if (config.webhookIssuer && payload.iss !== config.webhookIssuer) {
      throw new UnauthorizedException('Webhook JWT issuer is invalid');
    }
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (config.webhookAudience && !audiences.includes(config.webhookAudience)) {
      throw new UnauthorizedException('Webhook JWT audience is invalid');
    }
    if (!payload.qsh || !this.safeEqual(payload.qsh, this.queryStringHash(request))) {
      throw new UnauthorizedException('Webhook JWT request hash is invalid');
    }
    const bodyHash = payload.bodyHash ?? payload.body_hash;
    const expectedBodyHash = createHash('sha256').update(request.rawBody).digest('hex');
    if (!bodyHash || !this.safeEqual(bodyHash, expectedBodyHash)) {
      throw new UnauthorizedException('Webhook JWT body hash is invalid');
    }
  }

  private queryStringHash(request: WebhookRequest): string {
    const values = [...new URLSearchParams(request.query).entries()]
      .filter(([key]) => key.toLowerCase() !== 'jwt')
      .map(([key, value]) => [this.percentEncode(key), this.percentEncode(value)] as const)
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
    const canonicalQuery = values.map(([key, value]) => `${key}=${value}`).join('&');
    const canonical = [
      request.method.toUpperCase(),
      request.path.startsWith('/') ? request.path : `/${request.path}`,
      canonicalQuery,
    ].join('&');
    return createHash('sha256').update(canonical).digest('hex');
  }

  private percentEncode(value: string): string {
    return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
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
