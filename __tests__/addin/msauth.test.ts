/**
 * @jest-environment node
 */
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { verifyMicrosoftIdToken, isFdEmail, TENANT_ISSUER, TENANT_EMAIL_DOMAIN } from '../../lib/msauth';
import { createSessionToken, verifySessionToken } from '../../lib/auth-session';
import { FD_SHARED_CLIENT_ID } from '../../lib/vendor/fd-directory-client';
import { FD_TENANT_ID } from '../../lib/directory-auth';

describe('Microsoft ID token verification (lib/msauth.ts)', () => {
  let privateKey: CryptoKey;
  let jwks: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    publicJwk.kid = 'test-key-1';
    jwks = createLocalJWKSet({ keys: [publicJwk] });
  });

  async function mintIdToken(claims: Record<string, unknown> = {}, expiresIn = '1h'): Promise<string> {
    const builder = new SignJWT({
      preferred_username: 'ian@firedynamicsgroup.com',
      name: 'Ian Shaw',
      oid: 'oid-1234',
      tid: FD_TENANT_ID,
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer(TENANT_ISSUER)
      .setAudience(FD_SHARED_CLIENT_ID)
      .setIssuedAt();

    if (expiresIn) builder.setExpirationTime(expiresIn);
    return builder.sign(privateKey);
  }

  it('validates FD email domain helper', () => {
    expect(isFdEmail('ian@firedynamicsgroup.com')).toBe(true);
    expect(isFdEmail('SAM@FIREDYNAMICSGROUP.COM')).toBe(true);
    expect(isFdEmail('user@gmail.com')).toBe(false);
    expect(isFdEmail('attacker@evil.com')).toBe(false);
    expect(isFdEmail('')).toBe(false);
    expect(isFdEmail(null)).toBe(false);
  });

  it('accepts a valid ID token with correct audience, issuer, and FDG email', async () => {
    const token = await mintIdToken();
    const verified = await verifyMicrosoftIdToken(token, { jwks });
    expect(verified.email).toBe('ian@firedynamicsgroup.com');
    expect(verified.name).toBe('Ian Shaw');
    expect(verified.objectId).toBe('oid-1234');
  });

  it('rejects a token from a wrong tenant / issuer', async () => {
    const builder = new SignJWT({
      preferred_username: 'ian@firedynamicsgroup.com',
      tid: 'wrong-tenant-id',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer('https://login.microsoftonline.com/wrong-tenant-id/v2.0')
      .setAudience(FD_SHARED_CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime('1h');
    const token = await builder.sign(privateKey);

    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow();
  });

  it('rejects a token with wrong audience', async () => {
    const builder = new SignJWT({
      preferred_username: 'ian@firedynamicsgroup.com',
      tid: FD_TENANT_ID,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer(TENANT_ISSUER)
      .setAudience('some-other-client-id')
      .setIssuedAt()
      .setExpirationTime('1h');
    const token = await builder.sign(privateKey);

    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow();
  });

  it('rejects a non-FDG email address', async () => {
    const token = await mintIdToken({ preferred_username: 'intruder@external.com' });
    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow(/not_an_fd_address/);
  });

  it('rejects a guest account claim (acct: 1)', async () => {
    const token = await mintIdToken({ acct: 1 });
    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow(/guest_not_allowed/);
  });

  it('rejects an expired ID token', async () => {
    const token = await mintIdToken({}, '-10s');
    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow();
  });

  it('rejects a Graph access token (wrong audience / no identity email)', async () => {
    const builder = new SignJWT({
      scp: 'User.Read',
      tid: FD_TENANT_ID,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer(TENANT_ISSUER)
      .setAudience('https://graph.microsoft.com')
      .setIssuedAt()
      .setExpirationTime('1h');
    const token = await builder.sign(privateKey);

    await expect(verifyMicrosoftIdToken(token, { jwks })).rejects.toThrow();
  });
});

describe('Session tokens (lib/auth-session.ts)', () => {
  it('creates and verifies a signed session token', () => {
    const token = createSessionToken({ email: 'ian@firedynamicsgroup.com', name: 'Ian Shaw', objectId: 'oid-123' });
    const session = verifySessionToken(token);
    expect(session).not.toBeNull();
    expect(session?.email).toBe('ian@firedynamicsgroup.com');
    expect(session?.name).toBe('Ian Shaw');
  });

  it('refuses tampered session tokens', () => {
    const token = createSessionToken({ email: 'ian@firedynamicsgroup.com', name: 'Ian Shaw' });
    const tampered = token.slice(0, -4) + 'abcd';
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it('refuses null, empty, or garbage tokens', () => {
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken('')).toBeNull();
    expect(verifySessionToken('not-a-token')).toBeNull();
  });
});
