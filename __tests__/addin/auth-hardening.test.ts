/**
 * @jest-environment node
 *
 * Gaps in the direct-pushed add-in auth commits: ID-token shape, session signing,
 * the directory service key, and Office cookie flags.
 */
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet, type JWTVerifyGetKey } from 'jose';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/auth/microsoft/route';
import { GET as search } from '../../app/v1/projects/route';
import { GET as prefill } from '../../app/v1/projects/[id]/fee-proposal-prefill/route';
import { verifyMicrosoftIdToken, isFdEmail, TENANT_ISSUER } from '../../lib/msauth';
import {
  ADDIN_SESSION_COOKIE,
  createSessionToken,
  sessionCookieAttributes,
  verifySessionToken,
} from '../../lib/auth-session';
import { FD_SHARED_CLIENT_ID } from '../../lib/vendor/fd-directory-client';
import { FD_TENANT_ID } from '../../lib/directory-auth';

const DEV_SESSION_SECRET = 'fd-toolstation-session-secret';
const ROOT = path.join(__dirname, '../..');

function forgeDevSession(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', DEV_SESSION_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

describe('FD email check', () => {
  it('accepts only a single @firedynamicsgroup.com address', () => {
    expect(isFdEmail('ian@firedynamicsgroup.com')).toBe(true);
    expect(isFdEmail(' SAM@FIREDYNAMICSGROUP.COM ')).toBe(true);
    expect(isFdEmail('ian.shaw+fee@firedynamicsgroup.com')).toBe(true);
    expect(isFdEmail('@firedynamicsgroup.com')).toBe(false);
    expect(isFdEmail('a@b@firedynamicsgroup.com')).toBe(false);
    expect(isFdEmail('ian@notfiredynamicsgroup.com')).toBe(false);
    expect(isFdEmail('ian@corp.firedynamicsgroup.com')).toBe(false);
    expect(isFdEmail('ian@firedynamicsgroup.com.evil.com')).toBe(false);
    expect(isFdEmail('ian\r\n@firedynamicsgroup.com')).toBe(false);
    expect(isFdEmail('ian@firedynamicsgroup.com\r\nX-Injected: 1')).toBe(false);
  });
});

describe('Microsoft ID token verification gaps', () => {
  let privateKey: CryptoKey;
  let otherPrivateKey: CryptoKey;
  let jwks: JWTVerifyGetKey;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    publicJwk.kid = 'hardening-key';
    jwks = createLocalJWKSet({ keys: [publicJwk] });
    otherPrivateKey = (await generateKeyPair('RS256')).privateKey;
  });

  function mint(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
    return new SignJWT({
      preferred_username: 'ian@firedynamicsgroup.com',
      name: 'Ian Shaw',
      oid: 'oid-1234',
      tid: FD_TENANT_ID,
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'hardening-key', ...header })
      .setIssuer(TENANT_ISSUER)
      .setAudience(FD_SHARED_CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
  }

  it('rejects a token signed by a key that is not in the tenant JWKS', async () => {
    const token = await new SignJWT({
      preferred_username: 'ian@firedynamicsgroup.com',
      tid: FD_TENANT_ID,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'attacker' })
      .setIssuer(TENANT_ISSUER)
      .setAudience(FD_SHARED_CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otherPrivateKey);
    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow();
  });

  it('rejects an unsigned token and a token that is not RS256', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        preferred_username: 'ian@firedynamicsgroup.com',
        tid: FD_TENANT_ID,
        iss: TENANT_ISSUER,
        aud: FD_SHARED_CLIENT_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString('base64url');
    await expect(verifyMicrosoftIdToken(`${header}.${body}.`, { jwks })).rejects.toThrow();

    const hmac = createHmac('sha256', 'attacker-secret')
      .update('placeholder')
      .digest();
    void hmac;
    const hsHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const hsBody = body;
    const hsSig = createHmac('sha256', 'attacker-secret').update(`${hsHeader}.${hsBody}`).digest('base64url');
    await expect(verifyMicrosoftIdToken(`${hsHeader}.${hsBody}.${hsSig}`, { jwks })).rejects.toThrow();
  });

  it('rejects an access token that merely shares the client id audience', async () => {
    const token = await mint({ scp: 'User.Read access_as_user' });
    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow(/not_an_id_token/);
  });

  it('rejects an access token whose header type is at+jwt', async () => {
    const token = await mint({}, { typ: 'at+jwt' });
    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow(/not_an_id_token/);
  });

  it('rejects a token whose audience is a list that merely includes the client id', async () => {
    const token = await new SignJWT({
      preferred_username: 'ian@firedynamicsgroup.com',
      tid: FD_TENANT_ID,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'hardening-key' })
      .setIssuer(TENANT_ISSUER)
      .setAudience([FD_SHARED_CLIENT_ID, 'https://graph.microsoft.com'])
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow();
  });

  it('rejects a token issued to a different client even when aud matches', async () => {
    const token = await mint({ azp: '00000000-0000-0000-0000-000000000000' });
    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow(/wrong_client/);
  });

  it('rejects a token whose tid does not match the issuer tenant', async () => {
    const token = await mint({ tid: '72f988bf-86f1-41af-91ab-2d7cd011db47' });
    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow(/wrong_tenant/);
  });

  it('rejects a foreign identity provider', async () => {
    const token = await mint({ idp: 'https://login.microsoftonline.com/other-tenant/v2.0' });
    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow(/guest_not_allowed/);
  });
});

describe('session tokens fail closed', () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAuth = process.env.AUTH_SECRET;
  const previousPassword = process.env.APP_PASSWORD;

  afterEach(() => {
    env.NODE_ENV = previousNodeEnv;
    if (previousAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuth;
    if (previousPassword === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = previousPassword;
  });

  it('does not honour the built-in development secret in production', () => {
    env.NODE_ENV = 'production';
    delete process.env.AUTH_SECRET;
    delete process.env.APP_PASSWORD;

    expect(() => createSessionToken({ email: 'ian@firedynamicsgroup.com', name: 'Ian Shaw' })).toThrow(/session_secret_unconfigured/);

    const forged = forgeDevSession({
      email: 'ian@firedynamicsgroup.com',
      name: 'Ian Shaw',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(verifySessionToken(forged)).toBeNull();
  });

  it('rejects a signed session with no expiry or a non-FD email', () => {
    const missingExp = forgeDevSession({
      email: 'ian@firedynamicsgroup.com',
      name: 'Ian Shaw',
      iat: Math.floor(Date.now() / 1000),
    });
    expect(verifySessionToken(missingExp)).toBeNull();

    const outsider = forgeDevSession({
      email: 'ian@gmail.com',
      name: 'Ian',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(verifySessionToken(outsider)).toBeNull();

    const expired = forgeDevSession({
      email: 'ian@firedynamicsgroup.com',
      name: 'Ian Shaw',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    expect(verifySessionToken(expired)).toBeNull();
  });

  it('returns the email in lowercase', () => {
    const token = createSessionToken({ email: 'Ian@FireDynamicsGroup.com', name: 'Ian Shaw' });
    expect(verifySessionToken(token)?.email).toBe('ian@firedynamicsgroup.com');
  });
});

describe('Office session cookie', () => {
  it('is httpOnly, Secure and SameSite=None when the site is https, including proxied proto headers', () => {
    for (const request of [
      new Request('https://fd-toolstation.vercel.app/api/auth/microsoft'),
      new Request('http://internal/api/auth/microsoft', { headers: { 'x-forwarded-proto': 'HTTPS' } }),
      new Request('http://internal/api/auth/microsoft', { headers: { 'x-forwarded-proto': 'https,http' } }),
    ]) {
      const cookie = sessionCookieAttributes(request);
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.secure).toBe(true);
      expect(cookie.sameSite).toBe('none');
    }
  });

  it('does not set SameSite=None on plain http, where browsers would drop the cookie', () => {
    const cookie = sessionCookieAttributes(new Request('http://localhost:3100/api/auth/microsoft'));
    expect(cookie.secure).toBe(false);
    expect(cookie.sameSite).toBe('lax');
    expect(cookie.httpOnly).toBe(true);
  });
});

describe('POST /api/auth/microsoft cookie and secret', () => {
  it('sets a Secure httpOnly SameSite=None cookie on https and refuses to sign a session with the dev secret in production', async () => {
    const msauth = await import('../../lib/msauth');
    const spy = jest.spyOn(msauth, 'verifyMicrosoftIdToken').mockResolvedValue({
      email: 'ian@firedynamicsgroup.com',
      name: 'Ian Shaw',
      objectId: 'oid-1234',
    });
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAuth = process.env.AUTH_SECRET;
    const previousPassword = process.env.APP_PASSWORD;
    try {
      const ok = await POST(
        new Request('https://fd-toolstation.vercel.app/api/auth/microsoft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-proto': 'https' },
          body: JSON.stringify({ idToken: 'header.payload.sig' }),
        }),
      );
      expect(ok.status).toBe(200);
      const setCookie = ok.headers.get('set-cookie') ?? '';
      expect(setCookie.toLowerCase()).toContain('httponly');
      expect(setCookie.toLowerCase()).toContain('secure');
      expect(setCookie.toLowerCase()).toContain('samesite=none');

      env.NODE_ENV = 'production';
      delete process.env.AUTH_SECRET;
      delete process.env.APP_PASSWORD;
      const refused = await POST(
        new Request('https://fd-toolstation.vercel.app/api/auth/microsoft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: 'header.payload.sig' }),
        }),
      );
      expect(refused.status).toBe(500);
      expect(refused.headers.get('set-cookie') ?? '').not.toContain(ADDIN_SESSION_COOKIE);
    } finally {
      spy.mockRestore();
      env.NODE_ENV = previousNodeEnv;
      if (previousAuth === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = previousAuth;
      if (previousPassword === undefined) delete process.env.APP_PASSWORD;
      else process.env.APP_PASSWORD = previousPassword;
    }
  });
});

describe('directory proxy authentication', () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousKey = process.env.TOOLSTATION_SERVICE_KEY;
  const previousFetch = global.fetch;

  afterEach(() => {
    env.NODE_ENV = previousNodeEnv;
    if (previousKey === undefined) delete process.env.TOOLSTATION_SERVICE_KEY;
    else process.env.TOOLSTATION_SERVICE_KEY = previousKey;
    global.fetch = previousFetch;
  });

  it('rejects an unauthenticated prefill and does not call the directory', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await prefill(new NextRequest('https://fd-toolstation.vercel.app/v1/projects/synergy:1:2/fee-proposal-prefill'), {
      params: Promise.resolve({ id: 'synergy:1:2' }),
    });
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call the directory with the built-in development service key in production', async () => {
    env.NODE_ENV = 'production';
    delete process.env.TOOLSTATION_SERVICE_KEY;
    process.env.AUTH_SECRET = 'unit-test-session-secret';
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const token = createSessionToken({ email: 'ian@firedynamicsgroup.com', name: 'Ian Shaw' });
    const res = await search(
      new NextRequest('https://fd-toolstation.vercel.app/v1/projects?q=0406', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    delete process.env.AUTH_SECRET;
  });

  it('rejects an expired session before calling the directory', async () => {
    process.env.TOOLSTATION_SERVICE_KEY = 'test-toolstation-service-key-xyz';
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const expired = forgeDevSession({
      email: 'ian@firedynamicsgroup.com',
      name: 'Ian Shaw',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 30,
    });
    const res = await search(
      new NextRequest('http://localhost/v1/projects?q=0406', {
        headers: { Authorization: `Bearer ${expired}` },
      }),
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('service key stays off the client', () => {
  function walk(dir: string): string[] {
    const entries = readdirSync(dir);
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) files.push(...walk(full));
      else if (/\.(ts|tsx|js|jsx)$/.test(entry)) files.push(full);
    }
    return files;
  }

  function resolveImport(fromFile: string, spec: string): string | null {
    if (!spec.startsWith('.')) {
      if (spec === '../../lib/auth-session' || spec.endsWith('/auth-session') || spec.endsWith('/directory-upstream')) {
        return spec;
      }
      return null;
    }
    const base = path.resolve(path.dirname(fromFile), spec);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
    return candidates.find((candidate) => {
      try {
        return statSync(candidate).isFile();
      } catch {
        return false;
      }
    }) ?? null;
  }

  it('has no NEXT_PUBLIC_ name for the service key or session secret, and client modules do not import the server session', () => {
    const sourceFiles = ['app', 'components', 'hooks', 'lib'].flatMap((dir) => walk(path.join(ROOT, dir)));
    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/NEXT_PUBLIC_(TOOLSTATION_SERVICE_KEY|AUTH_SECRET|APP_PASSWORD)/);
    }

    const clientEntries = sourceFiles.filter((file) => {
      const rel = path.relative(ROOT, file);
      if (rel.startsWith(`app${path.sep}api${path.sep}`) || rel.startsWith(`app${path.sep}v1${path.sep}`)) return false;
      if (rel.startsWith('components') || rel.startsWith('hooks') || rel.startsWith(`app${path.sep}addin`)) return true;
      return readFileSync(file, 'utf8').includes("'use client'") || readFileSync(file, 'utf8').includes('"use client"');
    });

    const seen = new Set<string>();
    const queue = [...clientEntries];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const rel = path.relative(ROOT, file);
      expect(rel.endsWith(`${path.sep}auth-session.ts`) || rel.endsWith('auth-session.ts')).toBe(false);
      expect(rel.includes('directory-upstream')).toBe(false);
      const text = readFileSync(file, 'utf8');
      const specs = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
      for (const spec of specs) {
        const resolved = resolveImport(file, spec);
        if (!resolved) continue;
        if (resolved.includes('auth-session') || resolved.includes('directory-upstream')) {
          throw new Error(`${rel} imports ${spec}`);
        }
        if (resolved.startsWith(ROOT)) queue.push(resolved);
      }
    }
  });

  it('marks the session and directory proxy modules as server-only', () => {
    expect(readFileSync(path.join(ROOT, 'lib/auth-session.ts'), 'utf8')).toMatch(/import ['"]server-only['"]/);
    expect(readFileSync(path.join(ROOT, 'lib/directory-upstream.ts'), 'utf8')).toMatch(/import ['"]server-only['"]/);
  });
});
