import { fetchDashboardState } from '../../lib/cfd-api';

const state = {
  runner: { status: 'idle' as const, last_heartbeat: null, machine_name: 'Superbot' },
  current: null,
  queue: [],
  completed: [],
  errors: [],
};

describe('fetchDashboardState', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('polls the same-origin proxy and does not send an API key', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => state,
    }) as unknown as typeof fetch;

    await fetchDashboardState();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/cfd-dashboard/state');
    expect(String(url)).not.toContain('railway.app');
    expect(init).toEqual(expect.objectContaining({ cache: 'no-store' }));
    expect(JSON.stringify(init ?? {})).not.toMatch(/X-API-Key|FDS_API_KEY/i);
  });
});
