import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CfdDashboardPage from '../../app/cfd-dashboard/page';

const SUPER = '11111111-1111-4111-8111-111111111111';
const TINY = '22222222-2222-4222-8222-222222222222';
const CLOUD = '33333333-3333-4333-8333-333333333333';
const RUN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const machines = {
  machines: [
    {
      id: SUPER,
      name: 'Superbot',
      target_type: 'local',
      status: 'online',
      last_heartbeat_at: '2026-11-10T10:00:00Z',
    },
    {
      id: TINY,
      name: 'Tinybot',
      target_type: 'local',
      status: 'idle',
      last_heartbeat_at: '2026-11-10T09:30:00Z',
    },
    {
      id: CLOUD,
      name: 'Cloudbot',
      target_type: 'cloudhpc',
      status: 'offline',
      last_heartbeat_at: null,
    },
  ],
};

const runs = {
  runs: [
    {
      id: RUN,
      target: 'local',
      machine_id: SUPER,
      machine_name: 'Superbot',
      case_name: 'corridor-a',
      input_file_ref: 'cases/corridor-a.fds',
      status: 'running',
      progress_pct: 42,
      sim_time: 100,
      end_time: 300,
      started_at: '2026-11-10T09:00:00Z',
      ended_at: null,
      error: null,
      results_link: null,
      cost_estimate: null,
      cost_actual: null,
      cost_currency: null,
      created_by: 'ian',
      external_id: null,
      created_at: '2026-11-10T08:00:00Z',
    },
  ],
};

const legacyState = {
  runner: { status: 'online', last_heartbeat: '2026-11-10T10:00:00Z', machine_name: 'Superbot' },
  current: {
    id: 7,
    name: 'legacy-sim',
    status: 'running',
    meshes: 2,
    t_end: 10,
    progress_pct: 15,
    started_at: '2026-11-10T09:00:00Z',
    completed_at: null,
    error_msg: null,
    machine_name: 'Superbot',
    updated_at: '2026-11-10T10:00:00Z',
  },
  queue: [],
  completed: [],
  errors: [{ id: 8, name: 'legacy-error', status: 'error', error_msg: 'old failure', machine_name: 'Tinybot' }],
};

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('modelling runs dashboard', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') return json({ id: RUN, command_id: 'cmd' });
      if (url.includes('/api/cfd-dashboard/machines')) return json(machines);
      if (url.includes('/api/cfd-dashboard/state')) return json(legacyState);
      if (url.includes('/api/cfd-dashboard/runs')) return json(runs);
      return json({ detail: 'not found' }, 404);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('shows machines, runs, and the legacy runner status from the proxy', async () => {
    render(<CfdDashboardPage />);

    const machineList = await screen.findByRole('list', { name: 'Machines' });
    expect(machineList).toHaveTextContent('Superbot');
    expect(machineList).toHaveTextContent('online');
    expect(machineList).toHaveTextContent('Tinybot');
    expect(machineList).toHaveTextContent('idle');
    expect(machineList).toHaveTextContent('Cloudbot');
    expect(machineList).toHaveTextContent('offline');
    expect(machineList.querySelector('time[datetime="2026-11-10T10:00:00Z"]')).not.toBeNull();

    expect(await screen.findByRole('link', { name: 'View corridor-a' })).toHaveAttribute(
      'href',
      `/cfd-dashboard/runs/${RUN}`,
    );
    expect(within(screen.getByRole('table', { name: 'Runs' })).getByText('running')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Currently Running' })).toBeInTheDocument();
    expect(screen.getByText('legacy-sim')).toBeInTheDocument();
    expect(screen.getByText('legacy-error')).toBeInTheDocument();

    const called = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(called.some((url) => url.includes('/api/cfd-dashboard/state'))).toBe(true);
    expect(called.some((url) => url.includes('railway.app'))).toBe(false);
  });

  it('filters by target, machine, and status, and logs a search with the engineer', async () => {
    const user = userEvent.setup();
    render(<CfdDashboardPage />);
    await screen.findByText('corridor-a');

    await user.selectOptions(screen.getByLabelText('Target'), 'local');
    await user.selectOptions(screen.getByLabelText('Machine'), SUPER);
    await user.selectOptions(screen.getByLabelText('Status'), 'failed');
    await user.type(screen.getByLabelText('Engineer'), 'ian');
    await user.type(screen.getByRole('searchbox', { name: 'Search runs' }), 'corridor');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((call) => String(call[0]));
      const match = urls
        .map((url) => new URL(url, 'http://localhost'))
        .find(
          (url) =>
            url.pathname === '/api/cfd-dashboard/runs' &&
            url.searchParams.get('status') === 'failed' &&
            url.searchParams.get('q') === 'corridor' &&
            url.searchParams.get('user') === 'ian' &&
            url.searchParams.get('target') === 'local' &&
            url.searchParams.get('machine_id') === SUPER,
        );
      expect(match).toBeTruthy();
    });

    expect(screen.getByRole('link', { name: 'View corridor-a' })).toHaveAttribute(
      'href',
      `/cfd-dashboard/runs/${RUN}?from=search&q=corridor&user=ian`,
    );
    expect(screen.getByLabelText('Status').querySelector('option[value="error"]')).toBeNull();
  });

  it('starts a local run and does not offer CloudHPC or send an API key', async () => {
    const user = userEvent.setup();
    render(<CfdDashboardPage />);
    await screen.findByText('corridor-a');

    const startOn = screen.getByLabelText('Start on');
    expect(within(startOn).getByRole('option', { name: 'Superbot' })).toBeInTheDocument();
    expect(within(startOn).queryByRole('option', { name: 'Cloudbot' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start run' }));
    expect(await screen.findByText('Enter your name so the run is logged.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);

    await user.type(screen.getByLabelText('Engineer'), 'ian');
    await user.selectOptions(startOn, SUPER);
    await user.type(screen.getByLabelText('Case name'), 'new-case');
    await user.type(screen.getByLabelText('Input file'), 'cases/new-case.fds');
    await user.click(screen.getByRole('button', { name: 'Start run' }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST');
      expect(post?.[0]).toBe('/api/cfd-dashboard/runs');
      expect(post?.[1].body).toBe(
        JSON.stringify({
          machine_id: SUPER,
          case_name: 'new-case',
          input_file_ref: 'cases/new-case.fds',
          created_by: 'ian',
        }),
      );
      expect(JSON.stringify(post?.[1].headers ?? {})).not.toMatch(/X-API-Key|FDS_API_KEY/i);
    });
  });

  it('logs a search once when it is submitted or changed, and the 10s poll omits q', async () => {
    const user = userEvent.setup();
    const spy = jest.spyOn(window, 'setInterval');
    render(<CfdDashboardPage />);
    await screen.findByText('corridor-a');

    function runsRequests() {
      return fetchMock.mock.calls
        .map((call) => String(call[0]))
        .filter((url) => {
          const path = new URL(url, 'http://localhost').pathname;
          return path === '/api/cfd-dashboard/runs';
        })
        .map((url) => new URL(url, 'http://localhost'));
    }

    await user.type(screen.getByLabelText('Engineer'), 'ian');
    await user.type(screen.getByRole('searchbox', { name: 'Search runs' }), 'corridor');
    expect(runsRequests().some((url) => url.searchParams.has('q'))).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      const logged = runsRequests().filter((url) => url.searchParams.get('q') === 'corridor');
      expect(logged).toHaveLength(1);
      expect(logged[0].searchParams.get('user')).toBe('ian');
    });
    expect(screen.getByRole('link', { name: 'View corridor-a' })).toHaveAttribute(
      'href',
      `/cfd-dashboard/runs/${RUN}?from=search&q=corridor&user=ian`,
    );

    const polls = spy.mock.calls.filter((call) => call[1] === 10_000);
    expect(polls.length).toBeGreaterThan(0);
    await act(async () => {
      for (const poll of polls) {
        await (poll[0] as () => void | Promise<void>)();
      }
    });

    expect(runsRequests().filter((url) => url.searchParams.get('q') === 'corridor')).toHaveLength(1);
    const refreshed = runsRequests();
    expect(refreshed.at(-1)?.searchParams.has('q')).toBe(false);

    await user.clear(screen.getByRole('searchbox', { name: 'Search runs' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search runs' }), 'no-such-case');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(runsRequests().filter((url) => url.searchParams.get('q') === 'no-such-case')).toHaveLength(1);
    });
    expect(runsRequests().filter((url) => url.searchParams.get('q') === 'corridor')).toHaveLength(1);
    expect(screen.queryByText('corridor-a')).not.toBeInTheDocument();

    await act(async () => {
      for (const poll of polls) {
        await (poll[0] as () => void | Promise<void>)();
      }
    });
    expect(runsRequests().filter((url) => url.searchParams.has('q'))).toHaveLength(2);
    expect(screen.queryByText('corridor-a')).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it('polls the runs list about every 10s', async () => {
    const spy = jest.spyOn(window, 'setInterval');
    render(<CfdDashboardPage />);
    await screen.findByText('corridor-a');
    const polls = spy.mock.calls.filter((call) => call[1] === 10_000);
    expect(polls.length).toBeGreaterThan(0);
    const before = fetchMock.mock.calls.length;
    await act(async () => {
      await (polls[0][0] as () => void | Promise<void>)();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
    spy.mockRestore();
  });
});
