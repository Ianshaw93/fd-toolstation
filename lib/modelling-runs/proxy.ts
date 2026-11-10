/**
 * Server-side proxy for /cfd-dashboard.
 * The browser calls /api/cfd-dashboard/* and never sees FDS_API_KEY.
 *
 * Legacy rows can still say status "error". This proxy rewrites that to
 * "failed" for run payloads. GET /runs matches one status, so a failed
 * filter requests both failed and error and merges them by id.
 * GET /state is passed through so the legacy runner page still shows error.
 */

const DEFAULT_API = 'https://backendfornextapp-production.up.railway.app';
const ALLOWED_QUERY = ['target', 'machine_id', 'status', 'q', 'user', 'created_by', 'from'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProxyResult = {
  status: number;
  body: string;
  contentType: string;
};

export type ProxyInput = {
  method: string;
  pathSegments: string[];
  searchParams: URLSearchParams;
  bodyText: string | null;
};

type RouteKind = 'state' | 'machines' | 'runs-list' | 'run-detail' | 'run-create' | 'run-stop' | 'run-restart';

type RouteMatch = {
  kind: RouteKind;
  upstreamPath: string;
};

function apiBase(): string {
  const configured = process.env.FDS_API_URL || process.env.BACKEND_URL || DEFAULT_API;
  return configured.replace(/\/$/, '');
}

function redact(text: string, key: string): string {
  if (!key) return text;
  return text.split(key).join('[redacted]');
}

function jsonResult(status: number, body: unknown, key = ''): ProxyResult {
  return {
    status,
    body: redact(JSON.stringify(body), key),
    contentType: 'application/json',
  };
}

function isRunRecord(record: Record<string, unknown>): boolean {
  return 'case_name' in record || 'input_file_ref' in record || 'progress_pct' in record;
}

function mapRun(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = { ...(value as Record<string, unknown>) };
  if (Array.isArray(record.runs)) {
    record.runs = record.runs.map(mapRun);
  }
  if (record.status === 'error' && isRunRecord(record)) {
    record.status = 'failed';
  }
  return record;
}

export function mapLegacyRunStatuses(text: string): string {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return text;
    const record = { ...(parsed as Record<string, unknown>) };
    if (Array.isArray(record.runs)) {
      record.runs = record.runs.map(mapRun);
    }
    return JSON.stringify(mapRun(record));
  } catch {
    return text;
  }
}

function matchRoute(segments: string[], method: string): RouteMatch | 'method' | null {
  if (segments.length === 1 && segments[0] === 'state') {
    return method === 'GET' ? { kind: 'state', upstreamPath: 'state' } : 'method';
  }
  if (segments.length === 1 && segments[0] === 'machines') {
    return method === 'GET' ? { kind: 'machines', upstreamPath: 'machines' } : 'method';
  }
  if (segments.length === 1 && segments[0] === 'runs') {
    if (method === 'GET') return { kind: 'runs-list', upstreamPath: 'runs' };
    if (method === 'POST') return { kind: 'run-create', upstreamPath: 'runs' };
    return 'method';
  }
  if (segments.length === 2 && segments[0] === 'runs' && UUID.test(segments[1])) {
    return method === 'GET' ? { kind: 'run-detail', upstreamPath: `runs/${segments[1]}` } : 'method';
  }
  if (
    segments.length === 3 &&
    segments[0] === 'runs' &&
    UUID.test(segments[1]) &&
    (segments[2] === 'stop' || segments[2] === 'restart')
  ) {
    if (method !== 'POST') return 'method';
    return {
      kind: segments[2] === 'stop' ? 'run-stop' : 'run-restart',
      upstreamPath: `runs/${segments[1]}/${segments[2]}`,
    };
  }
  return null;
}

function buildUrl(upstreamPath: string, search: URLSearchParams, statusOverride?: string): string {
  const url = new URL(`${apiBase()}/cfd-dashboard/${upstreamPath}`);
  for (const key of ALLOWED_QUERY) {
    const value = key === 'status' && statusOverride !== undefined ? statusOverride : search.get(key);
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function upstreamInit(method: string, key: string, bodyText: string | null): RequestInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-API-Key': key,
  };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    return { method, headers, body: bodyText ?? '', cache: 'no-store' };
  }
  return { method, headers, cache: 'no-store' };
}

async function passthrough(res: Response, key: string, mapStatus: boolean): Promise<ProxyResult> {
  const text = await res.text();
  const body = mapStatus && res.ok ? mapLegacyRunStatuses(text) : text;
  return {
    status: res.status,
    body: redact(body, key),
    contentType: res.headers.get('content-type') || 'application/json',
  };
}

function runsOf(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { runs?: unknown }).runs)) {
    return [];
  }
  return (payload as { runs: Record<string, unknown>[] }).runs;
}

async function fetchFailedAndLegacy(
  key: string,
  search: URLSearchParams,
  init: RequestInit,
): Promise<ProxyResult> {
  const failedUrl = buildUrl('runs', search, 'failed');
  const errorUrl = buildUrl('runs', search, 'error');
  const [failedRes, errorRes] = await Promise.all([fetch(failedUrl, init), fetch(errorUrl, init)]);
  if (!failedRes.ok) return passthrough(failedRes, key, false);
  if (!errorRes.ok) return passthrough(errorRes, key, false);

  const failedJson = JSON.parse(await failedRes.text()) as unknown;
  const errorJson = JSON.parse(await errorRes.text()) as unknown;
  const byId = new Map<string, Record<string, unknown>>();
  for (const run of [...runsOf(failedJson), ...runsOf(errorJson)]) {
    const id = String(run.id ?? '');
    if (!byId.has(id)) byId.set(id, run);
  }
  const runs = [...byId.values()]
    .map((run) => mapRun(run) as Record<string, unknown>)
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  return jsonResult(200, { runs }, key);
}

export async function proxyCfdDashboard(input: ProxyInput): Promise<ProxyResult> {
  const key = (process.env.FDS_API_KEY ?? '').trim();
  if (!key) {
    return jsonResult(422, { detail: 'FDS_API_KEY is not configured' });
  }

  const method = input.method.toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    return jsonResult(405, { detail: 'Method not allowed' });
  }

  const route = matchRoute(input.pathSegments, method);
  if (route === 'method') return jsonResult(405, { detail: 'Method not allowed' });
  if (route === null) return jsonResult(404, { detail: 'Unknown modelling route' });

  const init = upstreamInit(method, key, input.bodyText);
  try {
    const failedFilter =
      route.kind === 'runs-list' &&
      (input.searchParams.get('status') === 'failed' || input.searchParams.get('status') === 'error');
    if (failedFilter) {
      return await fetchFailedAndLegacy(key, input.searchParams, init);
    }
    const res = await fetch(buildUrl(route.upstreamPath, input.searchParams), init);
    return await passthrough(res, key, route.kind !== 'state');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream request failed';
    return jsonResult(502, { detail: redact(message, key) }, key);
  }
}
