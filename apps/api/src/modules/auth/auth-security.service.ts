import { createHash, randomUUID, timingSafeEqual } from 'crypto';
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
const ACCOUNT_ACTION_WINDOW_SEC = 5 * 60;
const ACCOUNT_ACTION_ATTEMPTS_TTL_SEC = 15 * 60;
const CHANGE_PASSWORD_LIMIT = 5;
const LOGOUT_ALL_LIMIT = 10;
const ACCOUNT_MUTATION_LOCK_TTL_MS = 30_000;
const ACCOUNT_MUTATION_LOCK_WAIT_MS = 10_000;
const ACCOUNT_MUTATION_LOCK_RETRY_MS = 25;

interface MemoryEntry {
  count: number;
  expiresAt: number;
}

const BOOTSTRAP_IP_LIMIT = 5;

@Injectable()
export class AuthSecurityService {
  private readonly logger = new Logger(AuthSecurityService.name);
  private readonly memoryStore = new Map<string, MemoryEntry>();
  private readonly localLocks = new Map<string, Promise<void>>();

  constructor(private readonly queueService: QueueService) {}

  hashEmail(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').slice(0, 16);
  }

  hashUserAgent(userAgent: string): string {
    return createHash('sha256').update(userAgent).digest('hex');
  }

  private hashUserId(userId: string): string {
    return createHash('sha256').update(userId).digest('hex').slice(0, 16);
  }

  extractClientIp(
    _headers: Record<string, string | string[] | undefined>,
    fallback?: string,
  ): string {
    // Express derives req.ip from the socket and its configured trust-proxy
    // policy. Reading X-Forwarded-For directly would let clients spoof the
    // rate-limit key whenever the API is reachable without that proxy.
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
    const key = `auth:rl:${action}:ip:${this.hashIp(ip)}`;
    const count = await this.increment(key, IP_WINDOW_SEC);
    if (count > limit) {
      this.logger.warn(`auth_rate_limited action=${action} ipHash=${this.hashIp(ip)}`);
      return false;
    }
    return true;
  }

  async checkAccountRateLimit(
    userId: string,
    ip: string,
    action: 'change-password' | 'logout-all',
  ): Promise<boolean> {
    const userHash = this.hashUserId(userId);
    const ipHash = this.hashIp(ip);
    const [userCount, ipCount] = await this.incrementMany(
      [
        `auth:rl:${action}:user:${userHash}`,
        `auth:rl:${action}:ip:${ipHash}`,
      ],
      ACCOUNT_ACTION_WINDOW_SEC,
    );
    const limit = action === 'change-password' ? CHANGE_PASSWORD_LIMIT : LOGOUT_ALL_LIMIT;
    if (userCount > limit || ipCount > limit) {
      this.logger.warn(`auth_rate_limited action=${action} userHash=${userHash} ipHash=${ipHash}`);
      return false;
    }
    return true;
  }

  async getAccountActionDelayMs(
    userId: string,
    ip: string,
    action: 'change-password' | 'logout-all',
  ): Promise<number> {
    const attempts = await this.getCounters(
      this.accountAttemptsKeys(userId, ip, action),
    );
    return Math.min(attempts * PROGRESSIVE_DELAY_MS, MAX_PROGRESSIVE_DELAY_MS);
  }

  async recordAccountActionFailure(
    userId: string,
    ip: string,
    action: 'change-password' | 'logout-all',
  ): Promise<number> {
    const counts = await this.incrementMany(
      this.accountAttemptsKeys(userId, ip, action),
      ACCOUNT_ACTION_ATTEMPTS_TTL_SEC,
    );
    const attempts = Math.max(...counts);
    this.logger.warn(
      `auth_account_action_failed action=${action} userHash=${this.hashUserId(userId)} ipHash=${this.hashIp(ip)} attempt=${attempts}`,
    );
    return attempts;
  }

  async clearAccountActionFailures(
    userId: string,
    ip: string,
    action: 'change-password' | 'logout-all',
  ): Promise<void> {
    const keys = this.accountAttemptsKeys(userId, ip, action);
    const redis = this.queueService.getConnection();
    if (redis) {
      try {
        await redis.del(...keys);
        return;
      } catch {
        this.logger.warn('auth_counter_clear_redis_failed');
      }
    }
    for (const key of keys) this.memoryStore.delete(key);
  }

  private accountAttemptsKeys(
    userId: string,
    ip: string,
    action: 'change-password' | 'logout-all',
  ): [string, string] {
    return [
      `auth:attempts:${action}:user:${this.hashUserId(userId)}`,
      `auth:attempts:${action}:ip:${this.hashIp(ip)}`,
    ];
  }

  async withAccountMutationLock<T>(
    userId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const key = `auth:lock:profile:${this.hashUserId(userId)}`;
    return this.withLocalLock(key, async () => {
      const redis = this.queueService.getConnection();
      if (!redis) {
        this.logger.warn('auth_profile_lock_redis_unavailable');
        throw new Error('Account profile update lock unavailable');
      }

      const token = randomUUID();
      let acquired = false;
      try {
        const deadline = Date.now() + ACCOUNT_MUTATION_LOCK_WAIT_MS;
        do {
          acquired =
            (await redis.set(
              key,
              token,
              'PX',
              ACCOUNT_MUTATION_LOCK_TTL_MS,
              'NX',
            )) === 'OK';
          if (!acquired) {
            await new Promise((resolve) =>
              setTimeout(resolve, ACCOUNT_MUTATION_LOCK_RETRY_MS),
            );
          }
        } while (!acquired && Date.now() < deadline);
      } catch {
        this.logger.warn('auth_profile_lock_redis_failed');
        throw new Error('Account profile update lock unavailable');
      }

      if (!acquired) {
        throw new Error('Account profile update lock timed out');
      }

      let lockFailure: Error | null = null;
      let renewalInFlight: Promise<void> | null = null;
      const renew = setInterval(() => {
        if (renewalInFlight || lockFailure) return;
        renewalInFlight = redis.eval(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end",
          1,
          key,
          token,
          String(ACCOUNT_MUTATION_LOCK_TTL_MS),
        ).then((renewed) => {
          if (renewed !== 1) {
            lockFailure = new Error('Account profile update lock ownership lost');
          }
        }).catch(() => {
          lockFailure = new Error('Account profile update lock renewal failed');
        }).finally(() => {
          renewalInFlight = null;
        });
      }, ACCOUNT_MUTATION_LOCK_TTL_MS / 3);
      renew.unref?.();

      let result!: T;
      let operationFailed = false;
      let operationError: unknown;
      try {
        result = await operation();
      } catch (error) {
        operationFailed = true;
        operationError = error;
      } finally {
        clearInterval(renew);
        await renewalInFlight;
        try {
          const released = await redis.eval(
            "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
            1,
            key,
            token,
          );
          if (released !== 1) {
            lockFailure ??= new Error('Account profile update lock ownership lost');
          }
        } catch {
          lockFailure ??= new Error('Account profile update lock release failed');
        }
      }

      if (lockFailure) {
        this.logger.warn('auth_profile_lock_operation_failed');
        throw lockFailure;
      }
      if (operationFailed) throw operationError;
      return result;
    });
  }

  private async withLocalLock<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.localLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.localLocks.set(key, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.localLocks.get(key) === current) {
        this.localLocks.delete(key);
      }
    }
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
      try {
        const val = await redis.get(key);
        return val ? parseInt(val, 10) : 0;
      } catch {
        this.logger.warn('auth_counter_read_redis_failed');
      }
    }
    const entry = this.memoryStore.get(key);
    if (!entry || entry.expiresAt <= Date.now()) return 0;
    return entry.count;
  }

  private async getCounters(keys: string[]): Promise<number> {
    const redis = this.queueService.getConnection();
    if (redis) {
      try {
        const values = await redis.mget(...keys);
        return Math.max(
          0,
          ...values.map((value) => (value ? parseInt(value, 10) : 0)),
        );
      } catch {
        this.logger.warn('auth_counter_read_redis_failed');
      }
    }
    const now = Date.now();
    return Math.max(
      0,
      ...keys.map((key) => {
        const entry = this.memoryStore.get(key);
        return !entry || entry.expiresAt <= now ? 0 : entry.count;
      }),
    );
  }

  private async increment(key: string, ttlSec: number): Promise<number> {
    const redis = this.queueService.getConnection();
    if (redis) {
      try {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, ttlSec);
        }
        return count;
      } catch {
        this.logger.warn('auth_counter_increment_redis_failed');
      }
    }
    return this.incrementMemory(key, ttlSec);
  }

  private async incrementMany(
    keys: string[],
    ttlSec: number,
  ): Promise<number[]> {
    const redis = this.queueService.getConnection();
    if (redis) {
      try {
        const result = await redis.eval(
          "local result = {}; for i, key in ipairs(KEYS) do local count = redis.call('INCR', key); if count == 1 then redis.call('EXPIRE', key, ARGV[1]); end; result[i] = count; end; return result",
          keys.length,
          ...keys,
          String(ttlSec),
        );
        if (
          Array.isArray(result) &&
          result.length === keys.length &&
          result.every((value) => typeof value === 'number')
        ) {
          return result as number[];
        }
        throw new Error('Invalid Redis counter result');
      } catch {
        this.logger.warn('auth_counter_increment_redis_failed');
      }
    }
    return keys.map((key) => this.incrementMemory(key, ttlSec));
  }

  private incrementMemory(key: string, ttlSec: number): number {
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
    await this.increment(`auth:bootstrap:fail:${this.hashIp(ip)}`, IP_WINDOW_SEC);
    this.logger.warn(`auth_bootstrap_failed ipHash=${this.hashIp(ip)}`);
  }
}
