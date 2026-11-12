import { checkDirectoryAccessToken, getDirectoryAccessToken, setDirectoryAccessTokenProvider } from '../../lib/directory-auth';
import { DirectoryError, FD_DIRECTORY_SCOPE } from '../../lib/vendor/fd-directory-client';
import { fixtureAccessToken } from '../../test-fixtures/directory-contract-v1';

describe('directory access token', () => {
  afterEach(() => {
    setDirectoryAccessTokenProvider(null);
    delete (window as unknown as Record<string, unknown>).__FD_DIRECTORY_FIXTURE_TOKEN__;
  });

  it('uses the shared scope from the directory client', () => {
    expect(FD_DIRECTORY_SCOPE).toBe('api://2b180b8a-7cd3-40b2-83dd-8338103ce41e/access_as_user');
  });

  it('returns the provider token after checking it', async () => {
    const token = fixtureAccessToken();
    setDirectoryAccessTokenProvider(async () => token);
    await expect(getDirectoryAccessToken()).resolves.toBe(token);
  });

  it('fails closed with interaction_required when nobody has signed in', async () => {
    await expect(getDirectoryAccessToken()).rejects.toMatchObject({ name: 'DirectoryError', code: 'interaction_required' });
  });

  it('passes the provider DirectoryError through', async () => {
    setDirectoryAccessTokenProvider(async () => {
      throw new DirectoryError('interaction_required');
    });
    await expect(getDirectoryAccessToken()).rejects.toMatchObject({ code: 'interaction_required' });
  });

  it('accepts only an access_as_user access token for the directory API in the FD tenant', () => {
    expect(checkDirectoryAccessToken(fixtureAccessToken()).ok).toBe(true);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ aud: '2b180b8a-7cd3-40b2-83dd-8338103ce41e' })).ok).toBe(true);
    // ID token for the same client: right audience, no scp.
    expect(checkDirectoryAccessToken(fixtureAccessToken({ aud: '2b180b8a-7cd3-40b2-83dd-8338103ce41e', scp: undefined })).ok).toBe(false);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ aud: 'https://graph.microsoft.com', scp: 'User.Read' })).ok).toBe(false);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ aud: '00000003-0000-0000-c000-000000000000' })).ok).toBe(false);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ tid: '72f988bf-86f1-41af-91ab-2d7cd011db47' })).ok).toBe(false);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ scp: 'User.Read' })).ok).toBe(false);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ exp: 1 })).ok).toBe(false);
    expect(checkDirectoryAccessToken('not-a-jwt').ok).toBe(false);
  });

  it('never returns an ID or Graph token', async () => {
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken({ aud: '2b180b8a-7cd3-40b2-83dd-8338103ce41e', scp: undefined }));
    await expect(getDirectoryAccessToken()).rejects.toMatchObject({ code: 'not_an_access_token' });
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken({ aud: 'https://graph.microsoft.com', scp: 'User.Read' }));
    await expect(getDirectoryAccessToken()).rejects.toMatchObject({ code: 'wrong_audience' });
  });

  it('reads the browser fixture token only outside production', async () => {
    const previous = process.env.NODE_ENV;
    (window as unknown as Record<string, unknown>).__FD_DIRECTORY_FIXTURE_TOKEN__ = fixtureAccessToken();
    try {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      await expect(getDirectoryAccessToken()).rejects.toMatchObject({ code: 'interaction_required' });
      (process.env as Record<string, string>).NODE_ENV = 'development';
      await expect(getDirectoryAccessToken()).resolves.toMatch(/\./);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = previous as string;
    }
  });
});
