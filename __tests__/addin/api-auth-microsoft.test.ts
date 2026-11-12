/**
 * @jest-environment node
 */
import { POST } from '../../app/api/auth/microsoft/route';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { FD_SHARED_CLIENT_ID } from '../../lib/vendor/fd-directory-client';
import { FD_TENANT_ID } from '../../lib/directory-auth';
import { TENANT_ISSUER } from '../../lib/msauth';
import * as msauthModule from '../../lib/msauth';

describe('POST /api/auth/microsoft', () => {
  let privateKey: CryptoKey;
  let jwks: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    publicJwk.kid = 'test-key-2';
    jwks = createLocalJWKSet({ keys: [publicJwk] });
  });

  async function mintIdToken(claims: Record<string, unknown> = {}): Promise<string> {
    return new SignJWT({
      preferred_username: 'ian@firedynamicsgroup.com',
      name: 'Ian Shaw',
      oid: 'oid-1234',
      tid: FD_TENANT_ID,
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-2' })
      .setIssuer(TENANT_ISSUER)
      .setAudience(FD_SHARED_CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
  }

  it('rejects invalid or missing idToken with 400', async () => {
    const resEmpty = await POST(new Request('http://localhost/api/auth/microsoft', { method: 'POST', body: '{}' }));
    expect(resEmpty.status).toBe(400);

    const resGarbage = await POST(new Request('http://localhost/api/auth/microsoft', { method: 'POST', body: 'not-json' }));
    expect(resGarbage.status).toBe(400);
  });

  it('rejects unverified tokens with 401', async () => {
    const res = await POST(new Request('http://localhost/api/auth/microsoft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'invalid.token.here' }),
    }));
    expect(res.status).toBe(401);
  });

  it('verifies valid ID token, sets cookie and returns identity', async () => {
    // Spy on verifyMicrosoftIdToken so it uses test jwks
    const spy = jest.spyOn(msauthModule, 'verifyMicrosoftIdToken').mockResolvedValueOnce({
      email: 'ian@firedynamicsgroup.com',
      name: 'Ian Shaw',
      objectId: 'oid-1234',
    });

    const res = await POST(new Request('https://localhost:3100/api/auth/microsoft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'some.valid.token' }),
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.email).toBe('ian@firedynamicsgroup.com');
    expect(data.name).toBe('Ian Shaw');
    expect(typeof data.token).toBe('string');

    // Cookie check
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('fdg_addin_session');
    expect(setCookie?.toLowerCase()).toContain('httponly');
    expect(setCookie?.toLowerCase()).toContain('samesite=none');

    spy.mockRestore();
  });
});
