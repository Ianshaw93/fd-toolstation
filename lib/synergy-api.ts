// Shared project directory client for the Word add-in task pane.
// Same-origin routes forward the caller's FD bearer token. This file never holds a Synergy key.

import { directoryAuthorization } from './directory-auth';
import { parseSynergyRef } from './directory-prefill';

export interface SynergyProjectHit {
  /** Directory project id, `synergy:<organisation>:<project>`. */
  ref: string;
  synergy_project_id: number;
  organisation_id: number;
  label: string;
  status: string | null;
  active: boolean;
  name?: string;
  project_number?: string | null;
  location?: string | null;
  client_name?: string | null;
  manager?: string | null;
}

export interface SynergyCacheStatus {
  stale: boolean;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
}

export interface SynergySearchResponse {
  items: SynergyProjectHit[];
  cache: SynergyCacheStatus | null;
  result_total: number;
}

type DirectoryError = Error & { status?: number };

function directoryError(message: string, status?: number): DirectoryError {
  const error = new Error(message) as DirectoryError;
  if (status !== undefined) error.status = status;
  return error;
}

function failureMessage(status: number, body: Record<string, unknown>): string {
  if (status === 401) return 'Sign in to your FD account to use the project directory. Fill in details by hand meanwhile.';
  if (status === 503) return 'The project directory is not configured yet. Fill in details by hand.';
  const detail = body.detail ?? body.message ?? body.error;
  return typeof detail === 'string' ? detail : `Project directory error (${status})`;
}

function toHit(raw: unknown): SynergyProjectHit | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.label !== 'string') return null;
  let ref: string | null = null;
  if (typeof row.id === 'string' && parseSynergyRef(row.id)) ref = row.id;
  else if (typeof row.organisation_id === 'number' && typeof row.synergy_project_id === 'number') {
    ref = `synergy:${row.organisation_id}:${row.synergy_project_id}`;
  }
  const ids = ref ? parseSynergyRef(ref) : null;
  if (!ref || !ids) return null;
  const active = typeof row.isActive === 'boolean' ? row.isActive : row.active !== false;
  return {
    ref,
    organisation_id: ids.organisationId,
    synergy_project_id: ids.projectId,
    label: row.label,
    status: typeof row.status === 'string' ? row.status : active ? null : 'Inactive',
    active,
    name: typeof row.name === 'string' ? row.name : undefined,
    location: typeof row.location === 'string' ? row.location : null,
  };
}

/**
 * Searches the project directory by job number or project name.
 * Default hides inactive and archived records unless includeInactive is true.
 */
export async function searchSynergyProjects(
  query: string,
  includeInactive = false,
  limit = 20
): Promise<SynergySearchResponse> {
  const authorization = await directoryAuthorization();
  const params = new URLSearchParams({
    q: query,
    include_inactive: String(includeInactive),
    limit: String(limit),
  });

  const res = await fetch(`/synergy/projects?${params.toString()}`, {
    headers: { Accept: 'application/json', Authorization: authorization },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw directoryError(failureMessage(res.status, err), res.status);
  }

  const body = (await res.json()) as Record<string, unknown>;
  const rows = Array.isArray(body.items) ? body.items : [];
  const items = rows.map(toHit).filter((hit): hit is SynergyProjectHit => hit !== null);
  const cache = typeof body.cache === 'object' && body.cache !== null ? (body.cache as SynergyCacheStatus) : null;
  return { items, cache, result_total: typeof body.result_total === 'number' ? body.result_total : items.length };
}

export async function fetchFeeProposalPrefill(ref: string, signal?: AbortSignal): Promise<unknown> {
  const ids = parseSynergyRef(ref);
  if (!ids) throw directoryError('Not a directory project id.', 400);
  const authorization = await directoryAuthorization();
  const res = await fetch(`/synergy/projects/${ids.organisationId}/${ids.projectId}/fee-proposal-prefill`, {
    headers: { Accept: 'application/json', Authorization: authorization },
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw directoryError(failureMessage(res.status, err), res.status);
  }
  return res.json();
}

/**
 * Logs when a signed-in user selects/opens a Synergy directory row.
 * Returns 204 No Content. Does not create or mutate anything in Synergy.
 */
export async function logSynergyProjectOpen(
  orgId: number,
  projectId: number,
  rank = 0,
  clientSearchId?: string
): Promise<void> {
  try {
    await fetch(`/synergy/projects/${orgId}/${projectId}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rank, client_search_id: clientSearchId }),
    });
  } catch {
    // Audit log send is non-blocking
  }
}
