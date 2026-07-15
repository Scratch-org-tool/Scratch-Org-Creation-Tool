import { Injectable, Logger } from '@nestjs/common';

export type FirebaseIdentityErrorCode =
  | 'INVALID_PASSWORD'
  | 'EMAIL_NOT_FOUND'
  | 'INVALID_EMAIL'
  | 'EMAIL_EXISTS'
  | 'WEAK_PASSWORD'
  | 'TOO_MANY_ATTEMPTS_TRY_LATER'
  | 'OPERATION_NOT_ALLOWED'
  | 'USER_DISABLED'
  | 'UNKNOWN';

export interface FirebaseIdentitySession {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
}

interface FirebaseRestError {
  error?: { message?: string; code?: number };
}

@Injectable()
export class FirebaseIdentityService {
  private readonly logger = new Logger(FirebaseIdentityService.name);

  private getApiKey(): string {
    const key =
      process.env.FIREBASE_WEB_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
    if (!key || key.includes('your-')) {
      throw new Error('FIREBASE_WEB_API_KEY is not configured');
    }
    return key;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const apiKey = this.getApiKey();
    const url = `https://identitytoolkit.googleapis.com/v1/${path}?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as T & FirebaseRestError;
    if (!res.ok) {
      const code = this.parseErrorCode(data);
      this.logger.warn(`firebase_identity_error code=${code}`);
      throw new FirebaseIdentityError(code);
    }
    return data;
  }

  private parseErrorCode(data: FirebaseRestError): FirebaseIdentityErrorCode {
    const raw = data.error?.message ?? '';
    const match = raw.match(/^(EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_EMAIL|EMAIL_EXISTS|WEAK_PASSWORD|TOO_MANY_ATTEMPTS_TRY_LATER|OPERATION_NOT_ALLOWED|USER_DISABLED)/);
    return (match?.[1] as FirebaseIdentityErrorCode) ?? 'UNKNOWN';
  }

  async signInWithPassword(email: string, password: string): Promise<FirebaseIdentitySession> {
    const data = await this.post<{
      idToken: string;
      refreshToken: string;
      localId: string;
      email: string;
    }>('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken: true,
    });
    return {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      localId: data.localId,
      email: data.email,
    };
  }

  /**
   * Reauthenticate the token identity. The email must come from the verified
   * ID token; account request bodies intentionally have no email field.
   */
  async verifyCurrentPassword(
    tokenEmail: string,
    currentPassword: string,
    expectedUid: string,
  ): Promise<FirebaseIdentitySession> {
    if (!tokenEmail) {
      throw new FirebaseIdentityError('INVALID_PASSWORD');
    }
    const session = await this.signInWithPassword(tokenEmail, currentPassword);
    if (
      session.localId !== expectedUid
      || session.email.trim().toLowerCase() !== tokenEmail.trim().toLowerCase()
    ) {
      throw new FirebaseIdentityError('INVALID_PASSWORD');
    }
    return session;
  }

  async signUp(email: string, password: string, displayName: string): Promise<FirebaseIdentitySession> {
    const data = await this.post<{
      idToken: string;
      refreshToken: string;
      localId: string;
      email: string;
    }>('accounts:signUp', {
      email,
      password,
      returnSecureToken: true,
      displayName,
    });
    return {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      localId: data.localId,
      email: data.email,
    };
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await this.post('accounts:sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email,
    });
  }
}

export class FirebaseIdentityError extends Error {
  constructor(public readonly code: FirebaseIdentityErrorCode) {
    super(code);
    this.name = 'FirebaseIdentityError';
  }
}
