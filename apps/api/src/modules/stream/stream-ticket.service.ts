import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';

const STREAM_TICKET_TTL_SECONDS = 30;
const STREAM_TICKET_PREFIX = 'stream:ticket:';

export interface StreamTicketScope {
  userId: string;
  isAdmin: boolean;
}

@Injectable()
export class StreamTicketService {
  constructor(private readonly queueService: QueueService) {}

  async issue(scope: StreamTicketScope): Promise<{ ticket: string; expiresIn: number }> {
    const ticket = randomBytes(32).toString('base64url');
    const stored = await this.queueService.getConnection().set(
      `${STREAM_TICKET_PREFIX}${ticket}`,
      JSON.stringify(scope),
      'EX',
      STREAM_TICKET_TTL_SECONDS,
      'NX',
    );
    if (stored !== 'OK') return this.issue(scope);
    return { ticket, expiresIn: STREAM_TICKET_TTL_SECONDS };
  }

  async consume(ticket: string): Promise<StreamTicketScope | null> {
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(ticket)) return null;
    const key = `${STREAM_TICKET_PREFIX}${ticket}`;
    const raw = await this.queueService.getConnection().eval(
      "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
      1,
      key,
    );
    if (typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw) as Partial<StreamTicketScope>;
      if (typeof parsed.userId !== 'string' || typeof parsed.isAdmin !== 'boolean') {
        return null;
      }
      return { userId: parsed.userId, isAdmin: parsed.isAdmin };
    } catch {
      return null;
    }
  }
}
