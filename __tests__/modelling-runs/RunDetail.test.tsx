import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RunDetailView from '../../components/modelling-runs/RunDetailView';

const RUN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const detail = {
  id: RUN,
  target: 'local',
  machine_id: '11111111-1111-4111-8111-111111111111',
  machine_name: 'Superbot',
  case_name: 'corridor-a',
  input_file_ref: 'cases/corridor-a.fds',
  status: 'running',
  progress_pct: 42.5,
  sim_time: 100,
  end_time: 300,
  started_at: '2026-11-10T09:00:00Z',
  ended_at: null,
  error: 'mesh warning',
  results_link: 'https://example.com/results/corridor-a',
  cost_estimate: 12.5,
  cost_actual: null,
  cost_currency: 'EUR',
  created_by: 'ian',
  external_id: null,
  created_at: '2026-11-10T08:00:00Z',
  events: [
    {
      id: EVENT,
      run_id: RUN,
      machine_id: '11111111-1111-4111-8111-111111111111',
      event_type: 'sim_progress',
      message: 'Time 100s',
      payload: {},
      created_at: '2026-11-10T10:05:00Z',
    },
  ],
};

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('run detail', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/restart')) {
        return json({ detail: 'No .restart file for this case' }, 400);
      }
      if (url.includes('/series')) {
        return json({
          cursor: '0',
          hrr: { unit: 'kW', points: [], design: null },
          devices: [],
          series: {},
        });
      }
      if (init?.method === 'POST') return json({ ok: true, command: 'stop' });
      return json(detail);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('shows progress, log lines, events, results, and cost', async () => {
    render(<RunDetailView runId={RUN} fromSearch={false} query="" user="" />);

    expect(await screen.findByRole('progressbar', { name: 'Progress' })).toHaveAttribute('aria-valuenow', '42.5');
    expect(screen.getByText('42.5%')).toBeInTheDocument();
    expect(screen.getByText(/Sim time 100s \/ 300s/)).toBeInTheDocument();
    expect(screen.getByLabelText('Recent log')).toHaveTextContent('Time 100s');
    const events = screen.getByRole('list', { name: 'Events' });
    expect(events).toHaveTextContent('sim_progress');
    expect(events).toHaveTextContent('Time 100s');
    expect(screen.getByRole('link', { name: 'Results' })).toHaveAttribute(
      'href',
      'https://example.com/results/corridor-a',
    );
    expect(screen.getByText('12.5 EUR')).toBeInTheDocument();
    expect(screen.getByText('mesh warning')).toBeInTheDocument();
  });

  it('logs an open from search once, then polls without from=search', async () => {
    const spy = jest.spyOn(window, 'setInterval');
    render(<RunDetailView runId={RUN} fromSearch query="corridor" user="ian" />);
    await screen.findByText('corridor-a');

    const detailUrl = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find((url) => new URL(url, 'http://localhost').pathname === `/api/cfd-dashboard/runs/${RUN}`);
    const parsed = new URL(detailUrl ?? '', 'http://localhost');
    expect(parsed.pathname).toBe(`/api/cfd-dashboard/runs/${RUN}`);
    expect(parsed.searchParams.get('from')).toBe('search');
    expect(parsed.searchParams.get('q')).toBe('corridor');
    expect(parsed.searchParams.get('user')).toBe('ian');

    const poll = spy.mock.calls.find((call) => call[1] === 10_000);
    expect(poll).toBeTruthy();
    await act(async () => {
      await (poll?.[0] as () => void | Promise<void>)();
    });
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.at(-1)).not.toContain('from=search');
    spy.mockRestore();
  });

  it('asks before stopping and does not post until confirmed', async () => {
    const user = userEvent.setup();
    render(<RunDetailView runId={RUN} fromSearch={false} query="" user="" />);
    await screen.findByText('corridor-a');

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByRole('dialog', { name: 'Stop this run?' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await user.click(screen.getByRole('button', { name: 'Stop run' }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST');
      expect(String(post?.[0])).toBe(`/api/cfd-dashboard/runs/${RUN}/stop`);
      expect(JSON.stringify(post?.[1].headers ?? {})).not.toMatch(/X-API-Key|FDS_API_KEY/i);
    });
  });

  it('restarts without a confirmation dialog and shows the backend error', async () => {
    const user = userEvent.setup();
    render(<RunDetailView runId={RUN} fromSearch={false} query="" user="" />);
    await screen.findByText('corridor-a');

    await user.click(screen.getByRole('button', { name: 'Restart' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('No .restart file for this case');
    const post = fetchMock.mock.calls.find((call) => String(call[0]).includes('/restart'));
    expect(post?.[1].method).toBe('POST');
  });
});
