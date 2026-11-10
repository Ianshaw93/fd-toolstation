/**
 * Live HRR and DEVC series for the run page.
 *
 * The browser polls `/api/cfd-dashboard/runs/{id}/series?after=&since=`.
 * Choosing a device POSTs `{ selected_devc }` to that same path.
 * The server route attaches the API key. The runner ingest
 * `POST /cfd-dashboard/series` is not a browser route.
 *
 * Wire shape, aligned with the runner chart API:
 * - HRR samples are `{t, hrr}`.
 * - `devc` holds samples only for `selected_devc` (id and quantity catalog is separate).
 * - `selected_devc` is what the runner charts next.
 * - Live samples are capped at SERIES_MIN_DT seconds and SERIES_MAX_POINTS.
 * CSV parsing stays on the backend. This page does not reimplement it.
 */

export const SERIES_MIN_DT = 1;
export const SERIES_MAX_POINTS = 60;

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
  devc: Record<string, SeriesPoint[]>;
  selectedDevc: string[];
}

export interface SeriesView {
  cursor: string | null;
  hrrUnit: string;
  hrr: SeriesPoint[];
  design: SeriesPoint[] | null;
  devices: DeviceColumn[];
  devc: Record<string, SeriesPoint[]>;
  selectedDevc: string[];
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
    devc: {},
    selectedDevc: [],
  };
}

export function seriesPath(id: string, opts?: { after?: string | null }): string {
  const params = new URLSearchParams();
  if (opts?.after) {
    params.set('after', opts.after);
    params.set('since', opts.after);
  }
  const path = `/api/cfd-dashboard/runs/${encodeURIComponent(id)}/series`;
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function parseSelectedDevc(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const raw = (data as { selected_devc?: unknown }).selected_devc;
  if (typeof raw === 'string') return raw.trim() ? [raw.trim()] : [];
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function asPointList(value: unknown, valueKey: 'hrr' | 'v'): SeriesPoint[] {
  if (!Array.isArray(value)) throw new Error('Unexpected series response');
  const points: SeriesPoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { t?: unknown; hrr?: unknown; v?: unknown };
    const t = Number(record.t);
    const raw = valueKey === 'hrr' ? record.hrr : record.v;
    const v = Number(raw);
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    points.push({ t, v });
  }
  return points;
}

export function capSeries(points: SeriesPoint[]): SeriesPoint[] {
  const ordered = [...points].sort((a, b) => a.t - b.t);
  const kept: SeriesPoint[] = [];
  for (const point of ordered) {
    const last = kept[kept.length - 1];
    if (last && point.t - last.t < SERIES_MIN_DT) continue;
    if (last && point.t === last.t) {
      kept[kept.length - 1] = point;
      continue;
    }
    kept.push(point);
  }
  if (kept.length > SERIES_MAX_POINTS) return kept.slice(kept.length - SERIES_MAX_POINTS);
  return kept;
}

function sortPoints(points: SeriesPoint[]): SeriesPoint[] {
  return [...points].sort((a, b) => a.t - b.t);
}

export function mergePoints(existing: SeriesPoint[], incoming: SeriesPoint[]): SeriesPoint[] {
  const byTime = new Map<number, SeriesPoint>();
  for (const point of existing) byTime.set(point.t, point);
  for (const point of incoming) byTime.set(point.t, point);
  return capSeries(sortPoints([...byTime.values()]));
}

export function parseSeriesPayload(data: unknown): SeriesPayload {
  if (!data || typeof data !== 'object') throw new Error('Unexpected series response');
  const record = data as {
    cursor?: unknown;
    after?: unknown;
    hrr?: { unit?: unknown; points?: unknown; design?: unknown };
    devices?: unknown;
    devc?: unknown;
    selected_devc?: unknown;
  };
  const cursor = record.cursor ?? record.after;
  if (typeof cursor !== 'string' && typeof cursor !== 'number') {
    throw new Error('Unexpected series response');
  }
  if (String(cursor).trim() === '') throw new Error('Unexpected series response');
  if (!record.hrr || typeof record.hrr !== 'object' || !('design' in record.hrr)) {
    throw new Error('Unexpected series response');
  }
  if (record.hrr.design !== null && !Array.isArray(record.hrr.design)) {
    throw new Error('Unexpected series response');
  }
  if (!Array.isArray(record.devices)) throw new Error('Unexpected series response');
  if (record.devc != null && (typeof record.devc !== 'object' || Array.isArray(record.devc))) {
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

  const selectedDevc = parseSelectedDevc(record);
  const devc: Record<string, SeriesPoint[]> = {};
  const rawDevc = (record.devc ?? {}) as Record<string, unknown>;
  for (const id of selectedDevc) {
    devc[id] = asPointList(rawDevc[id] ?? [], 'v');
  }

  const unit = typeof record.hrr.unit === 'string' && record.hrr.unit.trim() ? record.hrr.unit.trim() : 'kW';
  return {
    cursor: String(cursor),
    hrr: {
      unit,
      points: asPointList(record.hrr.points, 'hrr'),
      design: record.hrr.design === null ? null : asPointList(record.hrr.design, 'hrr'),
    },
    devices,
    devc,
    selectedDevc,
  };
}

export function applySeriesPayload(
  prev: SeriesView,
  payload: SeriesPayload,
  mode: 'append' | 'replace',
): SeriesView {
  const devc: Record<string, SeriesPoint[]> = {};
  for (const id of payload.selectedDevc) {
    const incoming = payload.devc[id] ?? [];
    devc[id] =
      mode === 'replace' ? capSeries(incoming) : mergePoints(prev.devc[id] ?? [], incoming);
  }
  return {
    cursor: payload.cursor,
    hrrUnit: payload.hrr.unit || prev.hrrUnit,
    hrr: mode === 'replace' ? capSeries(payload.hrr.points) : mergePoints(prev.hrr, payload.hrr.points),
    design: payload.hrr.design === null ? null : sortPoints(payload.hrr.design),
    devices: payload.devices,
    devc,
    selectedDevc: payload.selectedDevc,
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
