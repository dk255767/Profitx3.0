import { createHmac } from 'node:crypto';
import { config } from '../config';

const TOKEN_PREFIX = 'v1';

export function createAuthToken(userId: string): string {
  const issuedAt = Date.now().toString();
  const signature = createHmac('sha256', config.appSecret)
    .update(`${TOKEN_PREFIX}:${userId}:${issuedAt}`)
    .digest('hex');

  return `${TOKEN_PREFIX}.${userId}.${issuedAt}.${signature}`;
}

export function verifyAuthToken(token: string): { userId: string } | null {
  const [prefix, userId, issuedAt, signature] = token.split('.');
  if (!prefix || !userId || !issuedAt || !signature) return null;
  if (prefix !== TOKEN_PREFIX) return null;

  const expected = createHmac('sha256', config.appSecret)
    .update(`${prefix}:${userId}:${issuedAt}`)
    .digest('hex');

  if (expected !== signature) return null;
  return { userId };
}
