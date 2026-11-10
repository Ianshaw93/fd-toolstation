import { readFileSync } from 'fs';
import { join } from 'path';
import {
  applySeriesPayload,
  deviceMatches,
  emptySeriesView,
  parseSeriesPayload,
  seriesPath,
  type DeviceColumn,
} from '../../lib/modelling-runs/series';

const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('series contract', () => {
  it('builds a same-origin series URL and never puts a key on it', () => {
    const first = new URL(seriesPath(RUN_ID), 'http://localhost');
    expect(first.pathname).toBe(`/api/cfd-dashboard/runs/${RUN_ID}/series`);
    expect(first.searchParams.get('devices')).toBe('');
    expect(first.searchParams.get('since')).toBeNull();
    expect(first.search).not.toMatch(/api_key|X-API-Key|FDS_API_KEY/i);

    const next = new URL(
      seriesPath(RUN_ID, { since: '9', devices: ['TC_01', 'VIS_02'] }),
      'http://localhost',
    );
    expect(next.searchParams.get('since')).toBe('9');
    expect(next.searchParams.get('devices')).toBe('TC_01,VIS_02');
  });

  it('parses the cursor, HRR points, a design curve, and the device catalog', () => {
    const parsed = parseSeriesPayload({
      cursor: 4,
      hrr: {
        points: [
          { t: 0, v: 0 },
          { t: '10', v: '120.5' },
          { t: 'nope', v: 1 },
        ],
        design: [
          { t: 0, v: 0 },
          { t: 30, v: 500 },
        ],
      },
      devices: [
        { id: 'TC_01', quantity: 'TEMPERATURE', unit: 'C' },
        { id: 'VIS_02', quantity: 'VISIBILITY' },
      ],
      series: { TC_01: [{ t: 0, v: 20 }] },
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
    expect(parsed.series.TC_01).toEqual([{ t: 0, v: 20 }]);
  });

  it('treats a null design curve as no deck target', () => {
    const parsed = parseSeriesPayload({
      cursor: '1',
      hrr: { unit: 'kW', points: [{ t: 1, v: 2 }], design: null },
      devices: [],
      series: {},
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
            { t: 0, v: 0 },
            { t: 10, v: 100 },
          ],
          design: [{ t: 0, v: 0 }, { t: 10, v: 80 }],
        },
        devices: [{ id: 'TC_01', quantity: 'TEMPERATURE' }],
        series: {},
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
            { t: 10, v: 100 },
            { t: 20, v: 250 },
          ],
          design: [{ t: 0, v: 0 }, { t: 10, v: 80 }],
        },
        devices: [{ id: 'TC_01', quantity: 'TEMPERATURE' }],
        series: { TC_01: [{ t: 20, v: 40 }] },
      }),
      'append',
    );

    expect(appended.cursor).toBe('2');
    expect(appended.hrr.map((point) => [point.t, point.v])).toEqual([
      [0, 0],
      [10, 100],
      [20, 250],
    ]);
    expect(appended.selected.TC_01).toEqual([{ t: 20, v: 40 }]);
    expect(appended.design).toEqual([
      { t: 0, v: 0 },
      { t: 10, v: 80 },
    ]);

    const replaced = applySeriesPayload(
      appended,
      parseSeriesPayload({
        cursor: '8',
        hrr: { unit: 'kW', points: [{ t: 0, v: 0 }], design: null },
        devices: [{ id: 'VIS_02', quantity: 'VISIBILITY' }],
        series: {
          VIS_02: [
            { t: 0, v: 30 },
            { t: 10, v: 12 },
          ],
        },
      }),
      'replace',
    );
    expect(replaced.design).toBeNull();
    expect(replaced.hrr).toEqual([{ t: 0, v: 0 }]);
    expect(replaced.selected.TC_01).toBeUndefined();
    expect(replaced.selected.VIS_02.map((point) => point.t)).toEqual([0, 10]);
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
