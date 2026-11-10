import { readFileSync } from 'fs';
import { join } from 'path';
import { proxyCfdDashboard } from '../../lib/modelling-runs/proxy';

const KEY = 'super-secret-key';
const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function call(
  method: string,
  pathSegments: string[],
  search = '',
  bodyText: string | null = null,
) {
  return proxyCfdDashboard({
    method,
    pathSegments,
    searchParams: new URLSearchParams(search),
    bodyText,
  });
}

describe('cfd-dashboard proxy', () => {
  const originalFetch = global.fetch;
  const env = {
    key: process.env.FDS_API_KEY,
    url: process.env.FDS_API_URL,
    publicKey: process.env.NEXT_PUBLIC_FDS_API_KEY,
  };

  beforeEach(() => {
    process.env.FDS_API_KEY = KEY;
    process.env.FDS_API_URL = 'http://backend.test';
    delete process.env.NEXT_PUBLIC_FDS_API_KEY;
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (env.key === undefined) delete process.env.FDS_API_KEY;
    else process.env.FDS_API_KEY = env.key;
    if (env.url === undefined) delete process.env.FDS_API_URL;
    else process.env.FDS_API_URL = env.url;
    if (env.publicKey === undefined) delete process.env.NEXT_PUBLIC_FDS_API_KEY;
    else process.env.NEXT_PUBLIC_FDS_API_KEY = env.publicKey;
  });

  it('returns 422 when the server key is missing and does not call upstream', async () => {
    delete process.env.FDS_API_KEY;
    process.env.NEXT_PUBLIC_FDS_API_KEY = 'public-secret';

    const result = await call('GET', ['runs']);

    expect(result.status).toBe(422);
    expect(JSON.parse(result.body).detail).toBe('FDS_API_KEY is not configured');
    expect(result.body).not.toContain('public-secret');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends X-API-Key from FDS_API_KEY and passes a wrong-key 403 through', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ detail: 'Invalid API key' }),
    });

    const result = await call('GET', ['machines']);

    expect(result.status).toBe(403);
    expect(JSON.parse(result.body)).toEqual({ detail: 'Invalid API key' });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://backend.test/cfd-dashboard/machines');
    expect(init.headers['X-API-Key']).toBe(KEY);
    expect(init.body).toBeUndefined();
  });

  it('forwards a run search without client secrets in the query', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ runs: [] }),
    });

    await call('GET', ['runs'], 'target=local&q=hall&user=ian&token=nope&api_key=nope');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/cfd-dashboard/runs');
    expect(parsed.searchParams.get('target')).toBe('local');
    expect(parsed.searchParams.get('q')).toBe('hall');
    expect(parsed.searchParams.get('user')).toBe('ian');
    expect(parsed.searchParams.get('token')).toBeNull();
    expect(parsed.searchParams.get('api_key')).toBeNull();
    expect(init.headers['X-API-Key']).toBe(KEY);
    expect(JSON.stringify(init)).not.toContain('nope');
  });

  it('maps legacy status error to failed and queries both when the filter is failed', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      const status = new URL(url).searchParams.get('status');
      const runs =
        status === 'failed'
          ? [
              {
                id: RUN_ID,
                case_name: 'kept',
                status: 'failed',
                created_at: '2026-11-10T10:00:00Z',
              },
            ]
          : [
              {
                id: RUN_ID,
                case_name: 'duplicate',
                status: 'error',
                created_at: '2026-11-10T10:00:00Z',
              },
              {
                id: OTHER_ID,
                case_name: 'legacy',
                status: 'error',
                created_at: '2026-11-10T09:00:00Z',
              },
            ];
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ runs }),
      };
    });

    const result = await call('GET', ['runs'], 'status=failed&q=hall&user=ian&machine_id=' + RUN_ID);

    const urls = (global.fetch as jest.Mock).mock.calls.map((entry) => String(entry[0]));
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      const parsed = new URL(url);
      expect(parsed.searchParams.get('q')).toBe('hall');
      expect(parsed.searchParams.get('user')).toBe('ian');
      expect(parsed.searchParams.get('machine_id')).toBe(RUN_ID);
    }
    expect(urls.map((url) => new URL(url).searchParams.get('status')).sort()).toEqual(['error', 'failed']);
    const body = JSON.parse(result.body);
    expect(body.runs.map((run: { id: string; status: string; case_name: string }) => [run.id, run.status, run.case_name])).toEqual([
      [RUN_ID, 'failed', 'kept'],
      [OTHER_ID, 'failed', 'legacy'],
    ]);
  });

  it('maps error to failed on an unfiltered list and on detail, and leaves /state alone', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (String(url).endsWith('/cfd-dashboard/state')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify({
              runner: { status: 'offline', last_heartbeat: null, machine_name: null },
              current: null,
              queue: [],
              completed: [],
              errors: [{ id: 1, name: 'old-case', status: 'error' }],
            }),
        };
      }
      if (String(url).includes(`/runs/${RUN_ID}`)) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify({
              id: RUN_ID,
              case_name: 'old-run',
              status: 'error',
              events: [{ id: OTHER_ID, event_type: 'sim_error', message: 'mesh blew up', status: 'error' }],
            }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () =>
          JSON.stringify({
            runs: [{ id: RUN_ID, case_name: 'old-run', status: 'error' }],
          }),
      };
    });

    const list = await call('GET', ['runs']);
    expect(JSON.parse(list.body).runs[0].status).toBe('failed');

    const detail = await call('GET', ['runs', RUN_ID], 'from=search&q=old&user=ian');
    const detailBody = JSON.parse(detail.body);
    expect(detailBody.status).toBe('failed');
    expect(detailBody.events[0].message).toBe('mesh blew up');
    expect(detailBody.events[0].status).toBe('error');

    const state = await call('GET', ['state']);
    expect(JSON.parse(state.body).errors[0].status).toBe('error');
  });

  it('forwards start, stop, and restart and hides the key if upstream echoes it', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ ok: true, echo: KEY }),
    });

    const result = await call('POST', ['runs', RUN_ID, 'stop'], '', '{"confirm":true}');

    expect(result.status).toBe(200);
    expect(result.body).not.toContain(KEY);
    expect(JSON.parse(result.body).echo).toBe('[redacted]');
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`http://backend.test/cfd-dashboard/runs/${RUN_ID}/stop`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"confirm":true}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('forwards a series read with since and devices and redacts the key', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ cursor: '2', echo: KEY, hrr: { points: [], design: null } }),
    });

    const result = await call(
      'GET',
      ['runs', RUN_ID, 'series'],
      'after=1&since=1&devices=TC_01&api_key=nope',
    );

    expect(result.status).toBe(200);
    expect(result.body).not.toContain(KEY);
    expect(JSON.parse(result.body).echo).toBe('[redacted]');
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe(`/cfd-dashboard/runs/${RUN_ID}/series`);
    expect(parsed.searchParams.get('after')).toBe('1');
    expect(parsed.searchParams.get('since')).toBe('1');
    expect(parsed.searchParams.get('devices')).toBe('TC_01');
    expect(parsed.searchParams.get('api_key')).toBeNull();
    expect(init.method).toBe('GET');
    expect(init.headers['X-API-Key']).toBe(KEY);
    expect(init.body).toBeUndefined();

    (global.fetch as jest.Mock).mockClear();
    await call('GET', ['runs', RUN_ID, 'series'], 'devices=');
    const emptyDevices = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(emptyDevices.pathname).toBe(`/cfd-dashboard/runs/${RUN_ID}/series`);
    expect(emptyDevices.searchParams.has('devices')).toBe(true);
    expect(emptyDevices.searchParams.get('devices')).toBe('');
  });

  it('saves selected_devc server-side and does not forward sample rows or the runner ingest', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ selected_devc: ['TC_01'], echo: KEY }),
    });

    const result = await call(
      'POST',
      ['runs', RUN_ID, 'series'],
      '',
      JSON.stringify({
        selected_devc: ['TC_01'],
        hrr: [{ t: 1, hrr: 9 }],
        devc: { TC_01: [{ t: 1, v: 2 }], bulk_0: [{ t: 1, v: 3 }] },
      }),
    );

    expect(result.status).toBe(200);
    expect(result.body).not.toContain(KEY);
    expect(JSON.parse(result.body).selected_devc).toEqual(['TC_01']);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`http://backend.test/cfd-dashboard/runs/${RUN_ID}/series`);
    expect(init.method).toBe('POST');
    expect(init.headers['X-API-Key']).toBe(KEY);
    expect(JSON.parse(init.body)).toEqual({ selected_devc: ['TC_01'] });

    (global.fetch as jest.Mock).mockClear();
    expect((await call('POST', ['series'], '', '{"hrr":[{"t":1,"hrr":2}]}')).status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects runner-only routes, non-uuids, and the wrong method', async () => {
    expect((await call('GET', ['commands'])).status).toBe(404);
    expect((await call('GET', ['runs', 'not-a-uuid'])).status).toBe(404);
    expect((await call('POST', ['state'])).status).toBe(405);
    expect((await call('GET', ['runs', RUN_ID, 'stop'])).status).toBe(405);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not put the key in a connection error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error(`connect ${KEY} refused`));
    const result = await call('GET', ['runs']);
    expect(result.status).toBe(502);
    expect(result.body).not.toContain(KEY);
  });

  it('reads the key only from the server env in the proxy source', () => {
    const proxy = readFileSync(join(__dirname, '../../lib/modelling-runs/proxy.ts'), 'utf8');
    const route = readFileSync(join(__dirname, '../../app/api/cfd-dashboard/[[...path]]/route.ts'), 'utf8');
    expect(proxy).toMatch(/process\.env\.FDS_API_KEY/);
    expect(proxy).not.toMatch(/NEXT_PUBLIC_/);
    expect(route).not.toMatch(/FDS_API_KEY|X-API-Key|NEXT_PUBLIC_/);
  });
});
