import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

const DEV_FALLBACK_KEY = 'default-dev-key-change-in-production-32bytes!!';

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY?.trim();
  if (!secret || secret === DEV_FALLBACK_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ENCRYPTION_KEY must be set to a strong random value in production ' +
          '(generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")',
      );
    }
    return scryptSync(DEV_FALLBACK_KEY, 'sfcc-salt', 32);
  }
  return scryptSync(secret, 'sfcc-salt', 32);
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(encryptedText: string): string {
  const key = getKey();
  const data = Buffer.from(encryptedText, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
