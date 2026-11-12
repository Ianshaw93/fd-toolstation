// Server-side validation of a Microsoft Entra ID token (SSO sign-in).
// Verifies signature against tenant JWKS, checks issuer, audience (client id), and @firedynamicsgroup.com email.

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { FD_SHARED_CLIENT_ID } from './vendor/fd-directory-client';
import { FD_TENANT_ID } from './directory-auth';

export const TENANT_ISSUER = `https://login.microsoftonline.com/${FD_TENANT_ID}/v2.0`;
export const TENANT_EMAIL_DOMAIN = 'firedynamicsgroup.com';

const defaultJwks = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${FD_TENANT_ID}/discovery/v2.0/keys`),
  { timeoutDuration: 5000, cooldownDuration: 30_000, cacheMaxAge: 6 * 3_600_000 },
);

export interface VerifiedIdentity {
  email: string;
  name: string;
  objectId?: string;
}

export interface VerifyOptions {
  jwks?: JWTVerifyGetKey;
  now?: number;
}

const FD_EMAIL = new RegExp(`^[a-z0-9.!#$%&'*+/=?^_\`{|}~-]+@${TENANT_EMAIL_DOMAIN.replace(/[.]/g, '\\.')}$`);

export function isFdEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  return FD_EMAIL.test(email.trim().toLowerCase());
}

export async function verifyMicrosoftIdToken(idToken: string, options: VerifyOptions = {}): Promise<VerifiedIdentity> {
  const keys = options.jwks ?? defaultJwks;

  const { payload, protectedHeader } = await jwtVerify(idToken, keys, {
    issuer: TENANT_ISSUER,
    audience: FD_SHARED_CLIENT_ID,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'tid'],
    ...(options.now !== undefined ? { currentDate: new Date(options.now) } : {}),
  });

  // jwtVerify treats aud as "contains". An ID token for this app is the client id itself,
  // not a list and not an access token (those carry scp, or typ at+jwt).
  const headerType = typeof protectedHeader.typ === 'string' ? protectedHeader.typ.toLowerCase() : '';
  if (headerType === 'at+jwt' || payload.scp !== undefined) {
    throw new Error('not_an_id_token');
  }
  if (payload.aud !== FD_SHARED_CLIENT_ID) {
    throw new Error('wrong_audience');
  }
  if (payload.azp !== undefined && payload.azp !== FD_SHARED_CLIENT_ID) {
    throw new Error('wrong_client');
  }

  if (payload.tid !== FD_TENANT_ID) {
    throw new Error('wrong_tenant');
  }

  // Reject guests (acct === 1 or "1")
  if (payload.acct === 1 || payload.acct === '1') {
    throw new Error('guest_not_allowed');
  }

  // Ensure it's not a foreign IDP
  const idp = typeof payload.idp === 'string' ? payload.idp : null;
  if (idp && idp !== TENANT_ISSUER && idp !== `https://sts.windows.net/${FD_TENANT_ID}/`) {
    throw new Error('guest_not_allowed');
  }

  // ID tokens populate preferred_username (UPN) or email
  const rawEmail = payload.preferred_username ?? payload.email;
  const email = typeof rawEmail === 'string' ? rawEmail.toLowerCase().trim() : '';
  if (!isFdEmail(email)) {
    throw new Error('not_an_fd_address');
  }

  const name =
    typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : email.split('@')[0];

  const objectId = typeof payload.oid === 'string' ? payload.oid : undefined;

  return { email, name, objectId };
}
