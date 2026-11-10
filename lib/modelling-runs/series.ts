/**
 * Live HRR and DEVC series for the run page.
 *
 * The browser only calls `/api/cfd-dashboard/runs/{id}/series`.
 * The server route attaches the API key.
 *
 * Stable shape shared with the backend:
 * `GET .../series?since={cursor}&devices={id,id}`
 * - `devices` is always sent. Empty means the column catalog only.
 * - `since` is omitted on the first read and when the selected device changes.
 * - Body: `{ cursor, hrr: { unit, points: [{t,v}], design: [{t,v}] | null },
 *   devices: [{id, quantity, unit?}], series: { [id]: [{t,v}] } }`
 * - `design` is null when the deck has no target curve.
 * - `series` holds samples for the requested ids, not every DEVC column.
 * CSV parsing stays in the backend (`hrr_graph` and the hrr/devc file pair).
 */

export interface SeriesPoint {
  t: number;
  v: number;
}

export interface DeviceColumn {
  id: string;
  quantity: string;
  unit?: string | null;
}

export interface SeriesPayload {
  cursor: string;
  hrr: {
    unit: string;
    points: SeriesPoint[];
    design: SeriesPoint[] | null;
  };
  devices: DeviceColumn[];
  series: Record<string, SeriesPoint[]>;
}

export interface SeriesView {
  cursor: string | null;
  hrrUnit: string;
  hrr: SeriesPoint[];
  design: SeriesPoint[] | null;
  devices: DeviceColumn[];
  selected: Record<string, SeriesPoint[]>;
}

const QUANTITY_TERMS: Record<string, string[]> = {
  temperature: ['temperature', 'temp', 'thermocouple'],
  visibility: ['visibility', 'vis'],
  pressure: ['pressure', 'pres'],
  velocity: ['velocity', 'vel'],
};

export function emptySeriesView(): SeriesView {
  return {
    cursor: null,
    hrrUnit: 'kW',
    hrr: [],
    design: null,
    devices: [],
    selected: {},
  };
}

export function seriesPath(
  id: string,
  opts?: { since?: string | null; devices?: string[] },
): string {
  const params = new URLSearchParams();
  if (opts?.since) params.set('since', opts.since);
  params.set('devices', (opts?.devices ?? []).join(','));
  return `/api/cfd-dashboard/runs/${encodeURIComponent(id)}/series?${params.toString()}`;
}

function parsePoints(value: unknown): SeriesPoint[] {
  if (!Array.isArray(value)) throw new Error('Unexpected series response');
  const points: SeriesPoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { t?: unknown; v?: unknown };
    const t = Number(record.t);
    const v = Number(record.v);
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    points.push({ t, v });
  }
  return points;
}

function sortPoints(points: SeriesPoint[]): SeriesPoint[] {
  return [...points].sort((a, b) => a.t - b.t);
}

export function mergePoints(existing: SeriesPoint[], incoming: SeriesPoint[]): SeriesPoint[] {
  const byTime = new Map<number, SeriesPoint>();
  for (const point of existing) byTime.set(point.t, point);
  for (const point of incoming) byTime.set(point.t, point);
  return sortPoints([...byTime.values()]);
}

export function parseSeriesPayload(data: unknown): SeriesPayload {
  if (!data || typeof data !== 'object') throw new Error('Unexpected series response');
  const record = data as {
    cursor?: unknown;
    hrr?: { unit?: unknown; points?: unknown; design?: unknown };
    devices?: unknown;
    series?: unknown;
  };
  const cursor = record.cursor;
  if (typeof cursor !== 'string' && typeof cursor !== 'number') {
    throw new Error('Unexpected series response');
  }
  if (!record.hrr || typeof record.hrr !== 'object' || !('design' in record.hrr)) {
    throw new Error('Unexpected series response');
  }
  if (record.hrr.design !== null && !Array.isArray(record.hrr.design)) {
    throw new Error('Unexpected series response');
  }
  if (!Array.isArray(record.devices)) throw new Error('Unexpected series response');
  if (!record.series || typeof record.series !== 'object' || Array.isArray(record.series)) {
    throw new Error('Unexpected series response');
  }

  const devices: DeviceColumn[] = [];
  for (const item of record.devices) {
    if (!item || typeof item !== 'object') continue;
    const column = item as { id?: unknown; quantity?: unknown; unit?: unknown };
    const id = typeof column.id === 'string' ? column.id.trim() : '';
    const quantity = typeof column.quantity === 'string' ? column.quantity.trim() : '';
    if (!id || !quantity) continue;
    devices.push({
      id,
      quantity,
      unit: typeof column.unit === 'string' ? column.unit : null,
    });
  }

  const series: Record<string, SeriesPoint[]> = {};
  for (const [id, points] of Object.entries(record.series as Record<string, unknown>)) {
    series[id] = parsePoints(points);
  }

  const unit = typeof record.hrr.unit === 'string' && record.hrr.unit.trim() ? record.hrr.unit.trim() : 'kW';
  return {
    cursor: String(cursor),
    hrr: {
      unit,
      points: parsePoints(record.hrr.points),
      design: record.hrr.design === null ? null : parsePoints(record.hrr.design),
    },
    devices,
    series,
  };
}

export function applySeriesPayload(
  prev: SeriesView,
  payload: SeriesPayload,
  mode: 'append' | 'replace',
  requestedIds?: string[],
): SeriesView {
  const allowed = requestedIds ? new Set(requestedIds) : null;
  const selected: Record<string, SeriesPoint[]> = mode === 'replace' ? {} : { ...prev.selected };
  for (const [id, points] of Object.entries(payload.series)) {
    if (allowed && !allowed.has(id)) continue;
    selected[id] = mode === 'replace' ? sortPoints(points) : mergePoints(prev.selected[id] ?? [], points);
  }
  return {
    cursor: payload.cursor,
    hrrUnit: payload.hrr.unit || prev.hrrUnit,
    hrr: mode === 'replace' ? sortPoints(payload.hrr.points) : mergePoints(prev.hrr, payload.hrr.points),
    design: payload.hrr.design === null ? null : sortPoints(payload.hrr.design),
    devices: payload.devices,
    selected,
  };
}

export function deviceMatches(device: DeviceColumn, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = `${device.id} ${device.quantity}`.toLowerCase();
  if (haystack.includes(needle)) return true;
  for (const terms of Object.values(QUANTITY_TERMS)) {
    const queryIsTerm = terms.some((term) => term === needle || (needle.length >= 4 && term.startsWith(needle)));
    if (!queryIsTerm) continue;
    if (terms.some((term) => haystack.includes(term))) return true;
  }
  return false;
}
