/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET as search } from '../../app/v1/projects/route';
import { GET as prefill } from '../../app/v1/projects/[id]/fee-proposal-prefill/route';

const BASE = 'https://directory-api-production-7f250373.up.railway.app';
const REF = 'synergy:5466:2694397';

function upstream(status: number, body: unknown = {}) {
  return jest.fn().mockResolvedValue({
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(body),
  });
}

describe('same-origin /v1 directory routes', () => {
  const previous = global.fetch;
  afterEach(() => {
    global.fetch = previous;
  });

  it('refuses a request with no bearer token and does not call the directory', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    expect((await search(new NextRequest('http://localhost/v1/projects?q=0406'))).status).toBe(401);
    const basic = new NextRequest('http://localhost/v1/projects?q=0406', { headers: { Authorization: 'Basic dXNlcjpwYXNz' } });
    expect((await search(basic)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards only the documented search query and only the bearer header', async () => {
    const fetchMock = upstream(200, { items: [] });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await search(
      new NextRequest('http://localhost/v1/projects?q=0406&include=inactive%2Carchived&limit=20&offset=0&evil=1', {
        headers: { Authorization: 'Bearer tok', Cookie: 'session=abc' },
      }),
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/v1/projects?q=0406&include=inactive%2Carchived&limit=20&offset=0`);
    expect(init.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer tok' });
    expect(init.redirect).toBe('error');
  });

  it('asks the directory for the canonical id, encoded as the shared client does', async () => {
    const fetchMock = upstream(200, {});
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await prefill(
      new NextRequest(`http://localhost/v1/projects/${encodeURIComponent(REF)}/fee-proposal-prefill`, { headers: { Authorization: 'Bearer tok' } }),
      { params: Promise.resolve({ id: REF }) },
    );
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/v1/projects/${encodeURIComponent(REF)}/fee-proposal-prefill`);
  });

  it('answers 404 for a malformed id without calling the directory', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await prefill(
      new NextRequest('http://localhost/v1/projects/x/fee-proposal-prefill', { headers: { Authorization: 'Bearer tok' } }),
      { params: Promise.resolve({ id: '../admin' }) },
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes 401, 403 and 503 through and returns 502 when the directory is unreachable', async () => {
    for (const status of [401, 403, 503]) {
      global.fetch = upstream(status, { error: 'x' }) as unknown as typeof fetch;
      const res = await search(new NextRequest('http://localhost/v1/projects?q=04', { headers: { Authorization: 'Bearer tok' } }));
      expect(res.status).toBe(status);
    }
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
    const res = await search(new NextRequest('http://localhost/v1/projects?q=04', { headers: { Authorization: 'Bearer tok' } }));
    expect(res.status).toBe(502);
  });
});
