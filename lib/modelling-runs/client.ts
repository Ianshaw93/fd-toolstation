import type { Machine, ModellingRun, RunEvent, RunFilters } from './types';

export type { Machine, ModellingRun, RunEvent, RunFilters } from './types';

/** Phase 2 turns CloudHPC on. Phase 1 does not start cloud runs. */
export const CLOUDHPC_ENABLED = false;

export const MODELLING_POLL_MS = 10_000;

/** Versioned so a later shape change does not reuse a bare name string. */
export const ENGINEER_STORAGE_KEY = 'fd.modelling.engineer.v1';

/** Same fields as the backend `q` filter: case name or input file, case-insensitive. */
export function runMatchesSearch(run: ModellingRun, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    (run.case_name || '').toLowerCase().includes(needle) ||
    (run.input_file_ref || '').toLowerCase().includes(needle)
  );
}

export function runsListPath(filters: RunFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.target) params.set('target', filters.target);
  if (filters.machine_id) params.set('machine_id', filters.machine_id);
  if (filters.status) params.set('status', filters.status);
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.user?.trim()) params.set('user', filters.user.trim());
  const qs = params.toString();
  return qs ? `/api/cfd-dashboard/runs?${qs}` : '/api/cfd-dashboard/runs';
}

export function runDetailPath(
  id: string,
  opts?: { fromSearch?: boolean; q?: string; user?: string },
): string {
  const params = new URLSearchParams();
  if (opts?.fromSearch) params.set('from', 'search');
  if (opts?.q?.trim()) params.set('q', opts.q.trim());
  if (opts?.user?.trim()) params.set('user', opts.user.trim());
  const path = `/api/cfd-dashboard/runs/${encodeURIComponent(id)}`;
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function runViewHref(id: string, query: string, user: string): string {
  const trimmed = query.trim();
  if (!trimmed) return `/cfd-dashboard/runs/${encodeURIComponent(id)}`;
  const params = new URLSearchParams();
  params.set('from', 'search');
  params.set('q', trimmed);
  if (user.trim()) params.set('user', user.trim());
  return `/cfd-dashboard/runs/${encodeURIComponent(id)}?${params.toString()}`;
}

export function messageFrom(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.detail === 'string' && record.detail.trim()) return record.detail;
  if (typeof record.error === 'string' && record.error.trim()) return record.error;
  if (Array.isArray(record.detail)) {
    const text = record.detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) return String((item as { msg: unknown }).msg);
        return String(item);
      })
      .filter(Boolean)
      .join('; ');
    return text || null;
  }
  return null;
}

export function parseMachines(data: unknown): Machine[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { machines?: unknown }).machines)) {
    throw new Error('Unexpected machines response');
  }
  return (data as { machines: Machine[] }).machines;
}

export function parseRuns(data: unknown): ModellingRun[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { runs?: unknown }).runs)) {
    throw new Error('Unexpected runs response');
  }
  return (data as { runs: ModellingRun[] }).runs;
}

export function parseRunDetail(data: unknown): ModellingRun {
  if (!data || typeof data !== 'object' || typeof (data as { id?: unknown }).id !== 'string') {
    throw new Error('Unexpected run detail');
  }
  const record = data as ModellingRun;
  const events = Array.isArray(record.events) ? record.events : [];
  return { ...record, events };
}

export function formatProgress(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(1)}%`;
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function logLines(events: RunEvent[] | undefined, limit = 20): string[] {
  const lines = (events ?? [])
    .map((event) => event.message?.trim() ?? '')
    .filter((line) => line.length > 0);
  return lines.slice(-limit);
}

export function safeResultsHref(link: string | null | undefined): string | null {
  if (!link) return null;
  if (link.startsWith('https://') || link.startsWith('http://') || link.startsWith('/')) return link;
  return null;
}

export async function postJson(url: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(messageFrom(payload) || `Request failed (${res.status})`);
  }
  return payload;
}
