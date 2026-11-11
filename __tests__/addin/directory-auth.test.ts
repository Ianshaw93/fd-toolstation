import {
  checkDirectoryAccessToken,
  directoryAuthorization,
  setDirectoryAccessTokenProvider,
  DIRECTORY_API_SCOPE,
} from '../../lib/directory-auth';
import { fixtureAccessToken } from '../../test-fixtures/directory-prefill-0406';

describe('directory access token', () => {
  afterEach(() => {
    setDirectoryAccessTokenProvider(null);
    delete (window as unknown as Record<string, unknown>).__FD_DIRECTORY_FIXTURE_TOKEN__;
  });

  it('asks the provider for the access_as_user scope and returns a bearer header', async () => {
    const provider = jest.fn(async () => fixtureAccessToken());
    setDirectoryAccessTokenProvider(provider);
    const header = await directoryAuthorization();
    expect(provider).toHaveBeenCalledWith([DIRECTORY_API_SCOPE]);
    expect(DIRECTORY_API_SCOPE).toBe('api://2b180b8a-7cd3-40b2-83dd-8338103ce41e/access_as_user');
    expect(header).toMatch(/^Bearer /);
  });

  it('fails closed when no FD sign-in is available', async () => {
    await expect(directoryAuthorization()).rejects.toMatchObject({ code: 'sign_in_unavailable' });
  });

  it('fails closed when silent acquisition fails', async () => {
    setDirectoryAccessTokenProvider(async () => {
      throw new Error('interaction_required');
    });
    await expect(directoryAuthorization()).rejects.toMatchObject({ code: 'sign_in_unavailable' });
  });

  it('accepts the directory API token and rejects ID, Graph, wrong-tenant, scope-less and expired tokens', () => {
    expect(checkDirectoryAccessToken(fixtureAccessToken()).ok).toBe(true);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ aud: '2b180b8a-7cd3-40b2-83dd-8338103ce41e' })).ok).toBe(true);
    // ID token: audience is the SPA client and there is no scp.
    expect(checkDirectoryAccessToken(fixtureAccessToken({ aud: '11111111-2222-3333-4444-555555555555', scp: undefined })).ok).toBe(false);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ aud: 'https://graph.microsoft.com', scp: 'User.Read' })).ok).toBe(false);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ aud: '00000003-0000-0000-c000-000000000000' })).ok).toBe(false);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ tid: '72f988bf-86f1-41af-91ab-2d7cd011db47' })).ok).toBe(false);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ scp: 'User.Read' })).ok).toBe(false);
    expect(checkDirectoryAccessToken(fixtureAccessToken({ exp: 1 })).ok).toBe(false);
    expect(checkDirectoryAccessToken('not-a-jwt').ok).toBe(false);
  });

  it('does not send a token that fails the check', async () => {
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken({ aud: 'https://graph.microsoft.com' }));
    await expect(directoryAuthorization()).rejects.toMatchObject({ code: 'wrong_token' });
  });

  it('ignores the browser fixture token in a production build', async () => {
    const previous = process.env.NODE_ENV;
    (window as unknown as Record<string, unknown>).__FD_DIRECTORY_FIXTURE_TOKEN__ = fixtureAccessToken();
    try {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      await expect(directoryAuthorization()).rejects.toMatchObject({ code: 'sign_in_unavailable' });
      (process.env as Record<string, string>).NODE_ENV = 'development';
      await expect(directoryAuthorization()).resolves.toMatch(/^Bearer /);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = previous as string;
    }
  });
});
