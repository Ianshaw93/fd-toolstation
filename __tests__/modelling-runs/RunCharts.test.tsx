import { readFileSync } from 'fs';
import { join } from 'path';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Plotly from 'plotly.js-dist-min';
import RunDetailView from '../../components/modelling-runs/RunDetailView';

type PlotTrace = {
  name?: string;
  x?: number[];
  y?: number[];
  type?: string;
  mode?: string;
  line?: { color?: string; dash?: string };
};

function plotCalls() {
  return (Plotly.react as unknown as jest.Mock).mock.calls as [
    HTMLElement,
    PlotTrace[],
    { font?: { family?: string } },
    { responsive?: boolean; displaylogo?: boolean },
  ][];
}

const RUN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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
  error: null,
  results_link: null,
  cost_estimate: null,
  cost_actual: null,
  cost_currency: null,
  created_by: 'ian',
  external_id: null,
  created_at: '2026-11-10T08:00:00Z',
  events: [],
};

const catalog = [
  { id: 'TC_01', quantity: 'TEMPERATURE', unit: 'C' },
  { id: 'VIS_stair', quantity: 'VISIBILITY', unit: 'm' },
  { id: 'P_lobby', quantity: 'PRESSURE', unit: 'Pa' },
  { id: 'V_door', quantity: 'VELOCITY', unit: 'm/s' },
];

function seriesBody(opts: {
  cursor: string;
  hrr?: { t: number; hrr: number }[];
  design?: { t: number; hrr: number }[] | null;
  devc?: Record<string, { t: number; v: number }[]>;
  selectedDevc?: string[];
}) {
  const extra: Record<string, { t: number; v: number }[]> = {};
  for (let i = 0; i < 300; i += 1) extra[`bulk_${i}`] = [{ t: 0, v: i }];
  return {
    cursor: opts.cursor,
    hrr: {
      unit: 'kW',
      points: opts.hrr ?? [
        { t: 0, hrr: 0 },
        { t: 10, hrr: 120 },
      ],
      design: opts.design === undefined ? [{ t: 0, hrr: 0 }, { t: 30, hrr: 400 }] : opts.design,
    },
    devices: catalog,
    devc: { ...extra, ...(opts.devc ?? {}) },
    selected_devc: opts.selectedDevc ?? [],
  };
}

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('run detail charts', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    let saved: string[] = [];
    fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/series') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body ?? '{}')) as { selected_devc?: string[] };
        saved = body.selected_devc ?? [];
        return json({ selected_devc: saved });
      }
      if (url.includes('/series')) {
        const devc: Record<string, { t: number; v: number }[]> = {};
        for (const id of saved) {
          devc[id] = [
            { t: 0, v: 20 },
            { t: 10, v: 55 },
          ];
        }
        return json(seriesBody({ cursor: '1', devc, selectedDevc: saved }));
      }
      return json(detail);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    (Plotly.react as unknown as jest.Mock).mockClear();
  });

  it('draws hrr.design from the series GET when the points are {t, hrr}', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/series')) {
        return json(
          seriesBody({
            cursor: '1',
            hrr: [
              { t: 0, hrr: 10 },
              { t: 20, hrr: 40 },
            ],
            design: [
              { t: 0, hrr: 0 },
              { t: 60, hrr: 500 },
            ],
          }),
        );
      }
      return json(detail);
    });

    render(<RunDetailView runId={RUN} fromSearch={false} query="" user="" />);

    await screen.findByRole('img', { name: /Heat release rate/i });
    await waitFor(() => {
      const hrr = plotCalls().find((call) => call[1].some((trace) => trace.name === 'Recorded HRR'));
      expect(hrr?.[1]).toEqual([
        {
          x: [0, 20],
          y: [10, 40],
          mode: 'lines',
          type: 'scatter',
          name: 'Recorded HRR',
          line: { color: '#4798EA' },
        },
        {
          x: [0, 60],
          y: [0, 500],
          mode: 'lines',
          type: 'scatter',
          name: 'Design HRR',
          line: { color: '#E10600', dash: 'dash' },
        },
      ]);
      expect(hrr?.[3]).toEqual({ responsive: true, displaylogo: false });
      expect(hrr?.[2].font?.family).toBe('Arial, Helvetica, sans-serif');
      expect(JSON.stringify(hrr?.[2])).not.toMatch(/Segoe UI/);
    });
    expect(screen.getByText('2 HRR samples')).toBeInTheDocument();
  });

  it('leaves the recorded HRR chart unchanged when hrr.design is null', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/series')) {
        return json(
          seriesBody({
            cursor: '1',
            hrr: [
              { t: 0, hrr: 10 },
              { t: 20, hrr: 40 },
            ],
            design: null,
          }),
        );
      }
      return json(detail);
    });
    render(<RunDetailView runId={RUN} fromSearch={false} query="" user="" />);
    await screen.findByRole('img', { name: /Heat release rate/i });
    await waitFor(() => {
      const hrr = plotCalls()
        .filter((call) => call[1].some((trace) => trace.name === 'Recorded HRR'))
        .at(-1);
      expect(hrr?.[1].map((trace) => trace.name)).toEqual(['Recorded HRR']);
      expect(hrr?.[1][0]).toMatchObject({ x: [0, 20], y: [10, 40], line: { color: '#4798EA' } });
      expect(hrr?.[1][0].line?.dash).toBeUndefined();
    });
    expect(screen.queryByText('Design HRR')).not.toBeInTheDocument();
    expect(screen.getByText('2 HRR samples')).toBeInTheDocument();
  });

  it('filters devices by id or quantity and requests only the selected series', async () => {
    const user = userEvent.setup();
    render(<RunDetailView runId={RUN} fromSearch={false} query="" user="" />);
    await screen.findByRole('img', { name: /Heat release rate/i });

    await user.type(screen.getByRole('searchbox', { name: 'Search devices' }), 'temperature');
    expect(screen.getByRole('option', { name: /TC_01/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /VIS_stair/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /P_lobby/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /V_door/ })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search devices' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search devices' }), 'pressure');
    await user.click(screen.getByRole('option', { name: /P_lobby/ }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        (call) => call[1]?.method === 'POST' && String(call[0]).includes('/series'),
      );
      expect(JSON.parse(String(post?.[1].body))).toEqual({ selected_devc: ['P_lobby'] });
      expect(JSON.stringify(post?.[1].headers ?? {})).not.toMatch(/X-API-Key|FDS_API_KEY/i);
      const gets = fetchMock.mock.calls.filter(
        (call) => !call[1]?.method && String(call[0]).includes('/series'),
      );
      const parsed = new URL(String(gets.at(-1)?.[0] ?? ''), 'http://localhost');
      expect(parsed.searchParams.get('devices')).toBeNull();
      expect(parsed.searchParams.get('after')).toBeNull();
    });

    await screen.findByRole('img', { name: /P_lobby/i });
    await waitFor(() => {
      const devc = plotCalls().find((call) => call[1].some((trace) => trace.name === 'PRESSURE'));
      expect(devc?.[1]).toEqual([
        {
          x: [0, 10],
          y: [20, 55],
          mode: 'lines',
          type: 'scatter',
          name: 'PRESSURE',
          line: { color: '#4798EA' },
        },
      ]);
    });
    const names = plotCalls().flatMap((call) => call[1].map((trace) => trace.name));
    expect(names.filter((name) => name === 'PRESSURE')).toHaveLength(1);
    expect(names.join(' ')).not.toMatch(/bulk_/);
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toMatch(/bulk_0/);
      expect(JSON.stringify(call[1] ?? {})).not.toMatch(/X-API-Key|FDS_API_KEY/i);
    }
  });

  it('appends HRR points on the 10s poll via the since cursor', async () => {
    let seriesCalls = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes('/series')) return json(detail);
      seriesCalls += 1;
      const parsed = new URL(url, 'http://localhost');
      if (seriesCalls === 1) {
        expect(parsed.searchParams.get('after')).toBeNull();
        expect(parsed.searchParams.get('since')).toBeNull();
        return json(
          seriesBody({
            cursor: '1',
            hrr: [
              { t: 0, hrr: 0 },
              { t: 10, hrr: 80 },
            ],
            design: null,
          }),
        );
      }
      expect(parsed.searchParams.get('after')).toBe('1');
      expect(parsed.searchParams.get('since')).toBe('1');
      return json(
        seriesBody({
          cursor: '2',
          hrr: [{ t: 20, hrr: 260 }],
          design: null,
        }),
      );
    });

    const spy = jest.spyOn(window, 'setInterval');
    render(<RunDetailView runId={RUN} fromSearch={false} query="" user="" />);
    expect(await screen.findByText('2 HRR samples')).toBeInTheDocument();

    const polls = spy.mock.calls.filter((call) => call[1] === 10_000);
    expect(polls.length).toBeGreaterThan(0);
    await act(async () => {
      for (const poll of polls) {
        await (poll[0] as () => void | Promise<void>)();
      }
    });
    expect(await screen.findByText('3 HRR samples')).toBeInTheDocument();
    await waitFor(() => {
      const hrr = plotCalls()
        .filter((call) => call[1].some((trace) => trace.name === 'Recorded HRR'))
        .at(-1);
      expect(hrr?.[1][0]).toMatchObject({ x: [0, 10, 20], y: [0, 80, 260] });
      expect(hrr?.[1]).toHaveLength(1);
    });
    spy.mockRestore();
  });

  it('uses the same chart for a finished run', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/series')) {
        return json(
          seriesBody({
            cursor: '9',
            hrr: [
              { t: 0, hrr: 0 },
              { t: 100, hrr: 400 },
              { t: 200, hrr: 400 },
            ],
            design: [{ t: 0, hrr: 50 }, { t: 200, hrr: 500 }],
          }),
        );
      }
      return json({ ...detail, status: 'completed', progress_pct: 100, ended_at: '2026-11-10T12:00:00Z' });
    });

    render(<RunDetailView runId={RUN} fromSearch={false} query="" user="" />);
    expect(await screen.findByText('3 HRR samples')).toBeInTheDocument();
    await waitFor(() => {
      const hrr = plotCalls().find((call) => call[1].some((trace) => trace.name === 'Design HRR'));
      expect(hrr?.[1][1]).toMatchObject({
        name: 'Design HRR',
        x: [0, 200],
        y: [50, 500],
        line: { color: '#E10600', dash: 'dash' },
      });
    });
    expect(screen.getByRole('img', { name: /Heat release rate/i })).toBeInTheDocument();
    const seriesUrl = fetchMock.mock.calls.map((call) => String(call[0])).find((url) => url.includes('/series'));
    expect(seriesUrl).toContain(`/api/cfd-dashboard/runs/${RUN}/series`);
  });

  it('keeps chart code off Segoe UI', () => {
    const chart = readFileSync(join(__dirname, '../../components/modelling-runs/RunCharts.tsx'), 'utf8');
    const line = readFileSync(join(__dirname, '../../components/warehouse-smoke/LineChart.tsx'), 'utf8');
    expect(chart).toMatch(/import\(['"]plotly\.js-dist-min['"]\)/);
    expect(chart).not.toMatch(/import\(['"]plotly\.js['"]\)/);
    expect(chart).not.toMatch(/from ['"]plotly\.js-dist['"]/);
    expect(chart).not.toMatch(/react-plotly/);
    expect(chart).not.toMatch(/Segoe UI/);
    expect(line).not.toMatch(/Segoe UI/);
  });
});
