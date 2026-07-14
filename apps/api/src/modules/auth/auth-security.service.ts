import { createHash, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';

const IP_WINDOW_SEC = 60;
const LOGIN_IP_LIMIT = 10;
const SIGNUP_IP_LIMIT = 10;
const FORGOT_IP_LIMIT = 5;
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_TTL_SEC = 15 * 60;
const ATTEMPTS_TTL_SEC = 15 * 60;
const PROGRESSIVE_DELAY_MS = 500;
const MAX_PROGRESSIVE_DELAY_MS = 5000;

interface MemoryEntry {
  count: number;
  expiresAt: number;
}

const BOOTSTRAP_IP_LIMIT = 5;

@Injectable()
export class AuthSecurityService {
  private readonly logger = new Logger(AuthSecurityService.name);
  private readonly memoryStore = new Map<string, MemoryEntry>();

  constructor(private readonly queueService: QueueService) {}

  hashEmail(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').slice(0, 16);
  }

  extractClientIp(headers: Record<string, string | string[] | undefined>, fallback?: string): string {
    const forwarded = headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() || fallback || 'unknown';
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
      return forwarded[0].split(',')[0]?.trim() || fallback || 'unknown';
    }
    return fallback || 'unknown';
  }

  async checkIpRateLimit(
    ip: string,
    action: 'login' | 'signup' | 'forgot' | 'bootstrap',
  ): Promise<boolean> {
    const limit =
      action === 'forgot'
        ? FORGOT_IP_LIMIT
        : action === 'signup'
          ? SIGNUP_IP_LIMIT
          : action === 'bootstrap'
            ? BOOTSTRAP_IP_LIMIT
            : LOGIN_IP_LIMIT;
    const key = `auth:rl:${action}:ip:${ip}`;
    const count = await this.increment(key, IP_WINDOW_SEC);
    if (count > limit) {
      this.logger.warn(`auth_rate_limited action=${action} ipHash=${this.hashIp(ip)}`);
      return false;
    }
    return true;
  }

  async isAccountLocked(emailHash: string): Promise<boolean> {
    const key = `auth:fail:${emailHash}`;
    const redis = this.queueService.getConnection();
    if (redis) {
      return (await redis.get(key)) === '1';
    }
    const entry = this.memoryStore.get(key);
    return entry !== undefined && entry.expiresAt > Date.now() && entry.count >= 1;
  }

  async getProgressiveDelayMs(emailHash: string): Promise<number> {
    const attempts = await this.getCounter(`auth:attempts:${emailHash}`);
    return Math.min(attempts * PROGRESSIVE_DELAY_MS, MAX_PROGRESSIVE_DELAY_MS);
  }

  async recordLoginFailure(emailHash: string, ip: string): Promise<number> {
    const attempts = await this.increment(`auth:attempts:${emailHash}`, ATTEMPTS_TTL_SEC);
    this.logger.warn(
      `auth_login_failed emailHash=${emailHash.slice(0, 12)} ipHash=${this.hashIp(ip)} attempt=${attempts}`,
    );
    if (attempts >= LOCKOUT_ATTEMPTS) {
      await this.setLockout(emailHash, ip);
    }
    return attempts;
  }

  async clearLoginFailures(emailHash: string): Promise<void> {
    const redis = this.queueService.getConnection();
    if (redis) {
      await redis.del(`auth:fail:${emailHash}`, `auth:attempts:${emailHash}`);
      return;
    }
    this.memoryStore.delete(`auth:fail:${emailHash}`);
    this.memoryStore.delete(`auth:attempts:${emailHash}`);
  }

  async setLockout(emailHash: string, ip: string): Promise<void> {
    const key = `auth:fail:${emailHash}`;
    const redis = this.queueService.getConnection();
    if (redis) {
      await redis.set(key, '1', 'EX', LOCKOUT_TTL_SEC);
    } else {
      this.memoryStore.set(key, { count: 1, expiresAt: Date.now() + LOCKOUT_TTL_SEC * 1000 });
    }
    this.logger.warn(`auth_account_locked emailHash=${emailHash.slice(0, 12)} ipHash=${this.hashIp(ip)}`);
  }

  private async getCounter(key: string): Promise<number> {
    const redis = this.queueService.getConnection();
    if (redis) {
      const val = await redis.get(key);
      return val ? parseInt(val, 10) : 0;
    }
    const entry = this.memoryStore.get(key);
    if (!entry || entry.expiresAt <= Date.now()) return 0;
    return entry.count;
  }

  private async increment(key: string, ttlSec: number): Promise<number> {
    const redis = this.queueService.getConnection();
    if (redis) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, ttlSec);
      }
      return count;
    }
    const now = Date.now();
    const entry = this.memoryStore.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.memoryStore.set(key, { count: 1, expiresAt: now + ttlSec * 1000 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  verifyBootstrapToken(token: string | undefined): boolean {
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET?.trim();
    if (!secret || !token?.trim()) return false;
    try {
      const a = createHash('sha256').update(token.trim()).digest();
      const b = createHash('sha256').update(secret).digest();
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async recordBootstrapFailure(ip: string): Promise<void> {
    await this.increment(`auth:bootstrap:fail:${ip}`, IP_WINDOW_SEC);
    this.logger.warn(`auth_bootstrap_failed ipHash=${this.hashIp(ip)}`);
  }
}
