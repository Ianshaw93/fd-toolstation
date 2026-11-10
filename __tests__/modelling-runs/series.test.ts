import { readFileSync } from 'fs';
import { join } from 'path';
import {
  SERIES_MAX_POINTS,
  SERIES_MIN_DT,
  applySeriesPayload,
  capSeries,
  deviceMatches,
  emptySeriesView,
  parseSelectedDevc,
  parseSeriesPayload,
  seriesPath,
  type DeviceColumn,
} from '../../lib/modelling-runs/series';

const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('series contract', () => {
  it('builds a same-origin series URL and never puts a key on it', () => {
    const first = new URL(seriesPath(RUN_ID), 'http://localhost');
    expect(first.pathname).toBe(`/api/cfd-dashboard/runs/${RUN_ID}/series`);
    expect(first.searchParams.get('after')).toBeNull();
    expect(first.searchParams.get('since')).toBeNull();
    expect(first.search).not.toMatch(/api_key|X-API-Key|FDS_API_KEY/i);

    const next = new URL(seriesPath(RUN_ID, { after: '9' }), 'http://localhost');
    expect(next.searchParams.get('after')).toBe('9');
    expect(next.searchParams.get('since')).toBe('9');
    expect(next.searchParams.get('devices')).toBeNull();
  });

  it('parses the cursor, HRR points, a design curve, and the device catalog', () => {
    const parsed = parseSeriesPayload({
      cursor: 4,
      hrr: {
        points: [
          { t: 0, hrr: 0 },
          { t: '10', hrr: '120.5' },
          { t: 'nope', hrr: 1 },
        ],
        design: [
          { t: 0, hrr: 0 },
          { t: 30, hrr: 500 },
        ],
      },
      devices: [
        { id: 'TC_01', quantity: 'TEMPERATURE', unit: 'C' },
        { id: 'VIS_02', quantity: 'VISIBILITY' },
      ],
      devc: { TC_01: [{ t: 0, v: 20 }], bulk_0: [{ t: 0, v: 1 }] },
      selected_devc: ['TC_01'],
    });

    expect(parsed.cursor).toBe('4');
    expect(parsed.hrr.unit).toBe('kW');
    expect(parsed.hrr.points).toEqual([
      { t: 0, v: 0 },
      { t: 10, v: 120.5 },
    ]);
    expect(parsed.hrr.design).toEqual([
      { t: 0, v: 0 },
      { t: 30, v: 500 },
    ]);
    expect(parsed.devices.map((device) => device.id)).toEqual(['TC_01', 'VIS_02']);
    expect(parsed.selectedDevc).toEqual(['TC_01']);
    expect(parsed.devc.TC_01).toEqual([{ t: 0, v: 20 }]);
    expect(parsed.devc.bulk_0).toBeUndefined();
  });

  it('treats a null design curve as no deck target', () => {
    const parsed = parseSeriesPayload({
      cursor: '1',
      hrr: { unit: 'kW', points: [{ t: 1, hrr: 2 }], design: null },
      devices: [],
      devc: {},
      selected_devc: [],
    });
    expect(parsed.hrr.design).toBeNull();
  });

  it('rejects a body that is not the series shape', () => {
    expect(() => parseSeriesPayload({ id: 'run' })).toThrow(/series/i);
    expect(() => parseSeriesPayload(null)).toThrow(/series/i);
  });

  it('appends points from a since cursor and replaces a device when the selection changes', () => {
    const first = applySeriesPayload(
      emptySeriesView(),
      parseSeriesPayload({
        cursor: '1',
        hrr: {
          unit: 'kW',
          points: [
            { t: 0, hrr: 0 },
            { t: 10, hrr: 100 },
          ],
          design: [{ t: 0, hrr: 0 }, { t: 10, hrr: 80 }],
        },
        devices: [{ id: 'TC_01', quantity: 'TEMPERATURE' }],
        devc: {},
        selected_devc: [],
      }),
      'replace',
    );
    const appended = applySeriesPayload(
      first,
      parseSeriesPayload({
        cursor: '2',
        hrr: {
          unit: 'kW',
          points: [
            { t: 10, hrr: 100 },
            { t: 20, hrr: 250 },
          ],
          design: [{ t: 0, hrr: 0 }, { t: 10, hrr: 80 }],
        },
        devices: [{ id: 'TC_01', quantity: 'TEMPERATURE' }],
        devc: { TC_01: [{ t: 20, v: 40 }] },
        selected_devc: ['TC_01'],
      }),
      'append',
    );

    expect(appended.cursor).toBe('2');
    expect(appended.hrr.map((point) => [point.t, point.v])).toEqual([
      [0, 0],
      [10, 100],
      [20, 250],
    ]);
    expect(appended.selectedDevc).toEqual(['TC_01']);
    expect(appended.devc.TC_01).toEqual([{ t: 20, v: 40 }]);
    expect(appended.design).toEqual([
      { t: 0, v: 0 },
      { t: 10, v: 80 },
    ]);

    const replaced = applySeriesPayload(
      appended,
      parseSeriesPayload({
        cursor: '8',
        hrr: { unit: 'kW', points: [{ t: 0, hrr: 0 }], design: null },
        devices: [{ id: 'VIS_02', quantity: 'VISIBILITY' }],
        devc: {
          VIS_02: [
            { t: 0, v: 30 },
            { t: 10, v: 12 },
          ],
          TC_01: [{ t: 0, v: 99 }],
        },
        selected_devc: 'VIS_02',
      }),
      'replace',
    );
    expect(replaced.design).toBeNull();
    expect(replaced.hrr).toEqual([{ t: 0, v: 0 }]);
    expect(replaced.devc.TC_01).toBeUndefined();
    expect(replaced.selectedDevc).toEqual(['VIS_02']);
    expect(replaced.devc.VIS_02.map((point) => point.t)).toEqual([0, 10]);
    expect(parseSelectedDevc({ selected_devc: ['TC_01', 'TC_01', '  '] })).toEqual(['TC_01']);
  });

  it('caps live samples at one second and 60 points', () => {
    expect(SERIES_MIN_DT).toBe(1);
    expect(SERIES_MAX_POINTS).toBe(60);
    const dense = Array.from({ length: 200 }, (_, i) => ({ t: i * 0.5, v: i }));
    const capped = capSeries(dense);
    expect(capped).toHaveLength(60);
    expect(capped[0].t).toBe(40);
    for (let i = 1; i < capped.length; i += 1) {
      expect(capped[i].t - capped[i - 1].t).toBeGreaterThanOrEqual(SERIES_MIN_DT);
    }
  });

  it('searches devices by id or by temperature, visibility, pressure, and velocity', () => {
    const devices: DeviceColumn[] = [
      { id: 'TC_01', quantity: 'TEMPERATURE' },
      { id: 'TC_beam', quantity: 'THERMOCOUPLE' },
      { id: 'VIS_stair', quantity: 'VISIBILITY' },
      { id: 'P_lobby', quantity: 'PRESSURE' },
      { id: 'V_door', quantity: 'VELOCITY' },
      { id: 'U_vent', quantity: 'U-VELOCITY' },
    ];
    const ids = (query: string) => devices.filter((device) => deviceMatches(device, query)).map((device) => device.id);

    expect(ids('')).toEqual(devices.map((device) => device.id));
    expect(ids('vis_stair')).toEqual(['VIS_stair']);
    expect(ids('temperature')).toEqual(['TC_01', 'TC_beam']);
    expect(ids('visibility')).toEqual(['VIS_stair']);
    expect(ids('pressure')).toEqual(['P_lobby']);
    expect(ids('velocity')).toEqual(['V_door', 'U_vent']);
    expect(ids('temperature')).not.toContain('VIS_stair');
  });

  it('does not name Segoe UI or the API key in the chart client', () => {
    const files = [
      '../../lib/modelling-runs/series.ts',
      '../../lib/modelling-runs/client.ts',
      '../../components/modelling-runs/RunCharts.tsx',
      '../../components/modelling-runs/RunDetailView.tsx',
    ];
    for (const file of files) {
      const src = readFileSync(join(__dirname, file), 'utf8');
      expect(src).not.toMatch(/Segoe UI/);
      expect(src).not.toMatch(/FDS_API_KEY/);
      expect(src).not.toMatch(/X-API-Key/);
    }
  });
});
