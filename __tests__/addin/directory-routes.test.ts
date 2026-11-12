/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET as search } from '../../app/v1/projects/route';
import { GET as prefill } from '../../app/v1/projects/[id]/fee-proposal-prefill/route';
import { createSessionToken, ADDIN_SESSION_COOKIE } from '../../lib/auth-session';

const BASE = 'https://directory-api-production-7f250373.up.railway.app';
const REF = 'synergy:5466:2694397';
const TEST_USER = { email: 'ian@firedynamicsgroup.com', name: 'Ian Shaw' };

function validSessionToken() {
  return createSessionToken(TEST_USER);
}

function upstream(status: number, body: unknown = {}) {
  return jest.fn().mockResolvedValue({
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(body),
  });
}

describe('same-origin /v1 directory routes with server service credential', () => {
  const previous = global.fetch;
  const previousKey = process.env.TOOLSTATION_SERVICE_KEY;

  beforeEach(() => {
    process.env.TOOLSTATION_SERVICE_KEY = 'test-toolstation-service-key-xyz';
  });

  afterEach(() => {
    global.fetch = previous;
    process.env.TOOLSTATION_SERVICE_KEY = previousKey;
  });

  it('refuses a request with no session and does not call the directory', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const noAuth = await search(new NextRequest('http://localhost/v1/projects?q=0406'));
    expect(noAuth.status).toBe(401);

    const badBearer = new NextRequest('http://localhost/v1/projects?q=0406', {
      headers: { Authorization: 'Bearer forged.token.here' },
    });
    expect((await search(badBearer)).status).toBe(401);

    const badCookie = new NextRequest('http://localhost/v1/projects?q=0406', {
      headers: { Cookie: `${ADDIN_SESSION_COOKIE}=bad-cookie-value` },
    });
    expect((await search(badCookie)).status).toBe(401);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never forwards browser tokens and attaches the service credential and forwarded user on the server only (via cookie)', async () => {
    const fetchMock = upstream(200, { items: [] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const token = validSessionToken();
    const res = await search(
      new NextRequest('http://localhost/v1/projects?q=0406&include=inactive%2Carchived&limit=20&offset=0&evil=1', {
        headers: {
          Cookie: `${ADDIN_SESSION_COOKIE}=${token}; other_cookie=ignore`,
          Authorization: 'Bearer browser-untrusted-token-should-not-forward',
        },
      }),
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/v1/projects?q=0406&include=inactive%2Carchived&limit=20&offset=0`);
    expect(init.headers.Accept).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer test-toolstation-service-key-xyz');
    expect(init.headers['x-toolstation-key']).toBe('test-toolstation-service-key-xyz');
    expect(init.headers['x-forwarded-user']).toBe('ian@firedynamicsgroup.com');
    // Ensure the browser's own bearer token was NOT forwarded
    expect(init.headers.Authorization).not.toBe('Bearer browser-untrusted-token-should-not-forward');
    expect(init.redirect).toBe('error');
  });

  it('accepts valid session via Authorization Bearer header as well as cookie', async () => {
    const fetchMock = upstream(200, { items: [] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const token = validSessionToken();
    const res = await search(
      new NextRequest('http://localhost/v1/projects?q=0406', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer test-toolstation-service-key-xyz');
    expect(init.headers['x-forwarded-user']).toBe('ian@firedynamicsgroup.com');
  });

  it('asks the directory for the canonical id, encoded as the shared client does', async () => {
    const fetchMock = upstream(200, {});
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await prefill(
      new NextRequest(`http://localhost/v1/projects/${encodeURIComponent(REF)}/fee-proposal-prefill`, {
        headers: { Authorization: `Bearer ${validSessionToken()}` },
      }),
      { params: Promise.resolve({ id: REF }) },
    );
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/v1/projects/${encodeURIComponent(REF)}/fee-proposal-prefill`);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['x-forwarded-user']).toBe('ian@firedynamicsgroup.com');
  });

  it('answers 404 for a malformed id without calling the directory', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await prefill(
      new NextRequest('http://localhost/v1/projects/x/fee-proposal-prefill', {
        headers: { Authorization: `Bearer ${validSessionToken()}` },
      }),
      { params: Promise.resolve({ id: '../admin' }) },
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes 401, 403 and 503 through and returns 502 when the directory is unreachable', async () => {
    for (const status of [401, 403, 503]) {
      global.fetch = upstream(status, { error: 'x' }) as unknown as typeof fetch;
      const res = await search(new NextRequest('http://localhost/v1/projects?q=04', {
        headers: { Authorization: `Bearer ${validSessionToken()}` },
      }));
      expect(res.status).toBe(status);
    }
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
    const res = await search(new NextRequest('http://localhost/v1/projects?q=04', {
      headers: { Authorization: `Bearer ${validSessionToken()}` },
    }));
    expect(res.status).toBe(502);
  });
});
