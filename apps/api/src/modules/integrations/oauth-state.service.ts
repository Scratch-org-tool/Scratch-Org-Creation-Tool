import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { createHash, randomBytes } from 'crypto';
import { decrypt, encrypt } from '../../common/crypto.util';

export interface OAuthStateValue<T> {
  appUserId: string;
  payload: T;
  returnPath: string;
}

@Injectable()
export class OAuthStateService {
  private static readonly TTL_MS = 10 * 60 * 1_000;

  async create<T>(
    provider: string,
    purpose: string,
    appUserId: string,
    payload: T,
    returnPath = '/environment-center',
    browserBinding?: string,
  ): Promise<string> {
    await this.safePurge();
    const safeReturnPath = this.safeReturnPath(returnPath);
    const state = randomBytes(32).toString('base64url');
    await prisma.oAuthState.create({
      data: {
        tokenHash: this.hash(state),
        browserBindingHash: browserBinding ? this.hash(this.validBrowserBinding(browserBinding)) : null,
        provider,
        purpose,
        appUserId,
        encryptedPayload: encrypt(JSON.stringify(payload)),
        returnPath: safeReturnPath,
        expiresAt: new Date(Date.now() + OAuthStateService.TTL_MS),
      },
    });
    return state;
  }

  async consume<T>(
    state: string,
    provider: string,
    purpose: string,
    expectedAppUserId?: string,
    expectedBrowserBinding?: string,
  ): Promise<OAuthStateValue<T>> {
    await this.safePurge();
    const tokenHash = this.hash(this.validToken(state));
    return prisma.$transaction(async (tx) => {
      const row = await tx.oAuthState.findUnique({ where: { tokenHash } });
      if (
        !row ||
        row.provider !== provider ||
        row.purpose !== purpose ||
        row.consumedAt ||
        row.expiresAt.getTime() <= Date.now() ||
        (expectedAppUserId && row.appUserId !== expectedAppUserId) ||
        (row.browserBindingHash !== null &&
          (!expectedBrowserBinding ||
            row.browserBindingHash !== this.hash(this.validBrowserBinding(expectedBrowserBinding))))
      ) {
        throw this.invalid();
      }
      const payload = this.payload<T>(row.encryptedPayload);
      const consumed = await tx.oAuthState.updateMany({
        where: {
          id: row.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date(), encryptedPayload: null },
      });
      if (consumed.count !== 1) throw this.invalid();
      return {
        appUserId: row.appUserId,
        payload,
        returnPath: this.safeReturnPath(row.returnPath),
      };
    });
  }

  async inspect<T>(
    state: string,
    provider: string,
    purpose: string,
    expectedAppUserId: string,
  ): Promise<OAuthStateValue<T>> {
    await this.safePurge();
    const row = await prisma.oAuthState.findUnique({
      where: { tokenHash: this.hash(this.validToken(state)) },
    });
    if (
      !row ||
      row.provider !== provider ||
      row.purpose !== purpose ||
      row.appUserId !== expectedAppUserId ||
      row.consumedAt ||
      row.expiresAt.getTime() <= Date.now()
    ) {
      throw this.invalid();
    }
    return {
      appUserId: row.appUserId,
      payload: this.payload<T>(row.encryptedPayload),
      returnPath: this.safeReturnPath(row.returnPath),
    };
  }

  newBrowserBinding(): string {
    return randomBytes(32).toString('base64url');
  }

  async purge(): Promise<number> {
    const result = await prisma.oAuthState.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() } },
          { consumedAt: { not: null } },
        ],
      },
    });
    return result.count;
  }

  private async safePurge(): Promise<void> {
    // Cleanup must never make a valid authorization unavailable.
    await this.purge().catch(() => undefined);
  }

  private payload<T>(ciphertext: string | null): T {
    if (!ciphertext) throw this.invalid();
    try {
      return JSON.parse(decrypt(ciphertext)) as T;
    } catch {
      throw this.invalid();
    }
  }

  private validToken(state: string): string {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw this.invalid();
    return state;
  }

  private validBrowserBinding(value: string): string {
    if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw this.invalid();
    return value;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeReturnPath(value: string): string {
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
      throw new BadRequestException('Invalid integration return path');
    }
    const parsed = new URL(value, 'https://integration.invalid');
    if (parsed.origin !== 'https://integration.invalid') {
      throw new BadRequestException('Invalid integration return path');
    }
    return `${parsed.pathname}${parsed.search}`;
  }

  private invalid(): BadRequestException {
    return new BadRequestException('OAuth state is invalid, expired, or already used');
  }
}
