// Session cookie and signed session token for the Word add-in task pane.
// Server-only: the signing key and the token minting must never reach the client bundle.

import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isFdEmail } from './msauth';
import { FD_SHARED_CLIENT_ID } from './vendor/fd-directory-client';
import { FD_TENANT_ID } from './directory-auth';

export const ADDIN_SESSION_COOKIE = 'fdg_addin_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AddinSession {
  email: string;
  name: string;
  objectId?: string;
  iat: number;
  exp: number;
}

const DEV_SESSION_SECRET = 'fd-toolstation-session-secret';

function sessionSigningKey(): string {
  const configured = process.env.AUTH_SECRET || process.env.APP_PASSWORD;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('session_secret_unconfigured');
  }
  return DEV_SESSION_SECRET;
}

function hmac(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Creates a signed session token formatted as a 3-part pseudo-JWT:
 * Header: {"alg":"HS256","typ":"JWT"}
 * Payload: session data with aud, tid, scp: "access_as_user"
 * Signature: HMAC-SHA256
 */
export function createSessionToken(identity: { email: string; name: string; objectId?: string }): string {
  const email = identity.email.trim().toLowerCase();
  if (!isFdEmail(email)) throw new Error('not_an_fd_address');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_MAX_AGE_SECONDS;
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      email,
      name: identity.name,
      objectId: identity.objectId,
      preferred_username: email,
      sub: identity.objectId ?? email,
      oid: identity.objectId,
      tid: FD_TENANT_ID,
      aud: `api://${FD_SHARED_CLIENT_ID}`,
      scp: 'access_as_user',
      iat: now,
      exp,
    }),
  ).toString('base64url');
  const signature = hmac(`${header}.${payload}`, sessionSigningKey());
  return `${header}.${payload}.${signature}`;
}

export function verifySessionToken(token: string | null | undefined): AddinSession | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  let key: string;
  try {
    key = sessionSigningKey();
  } catch {
    return null;
  }
  const expectedSig = hmac(`${header}.${payload}`, key);
  if (!constantTimeEqual(signature, expectedSig)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (!isFdEmail(email)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof data.exp !== 'number' || !Number.isFinite(data.exp) || data.exp <= now) return null;
    if (typeof data.iat !== 'number' || !Number.isFinite(data.iat)) return null;
    return {
      email,
      name: data.name || email.split('@')[0],
      objectId: data.objectId,
      iat: data.iat,
      exp: data.exp,
    };
  } catch {
    return null;
  }
}

export function sessionCookieAttributes(request: Request): {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
  maxAge: number;
} {
  const forwarded = request.headers.get('x-forwarded-proto');
  const raw = forwarded ?? new URL(request.url).protocol.replace(/:$/, '');
  const secure = raw.split(',')[0]?.trim().toLowerCase() === 'https';
  return {
    name: ADDIN_SESSION_COOKIE,
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
