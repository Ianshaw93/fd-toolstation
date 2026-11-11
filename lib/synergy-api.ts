// Shared project directory client for the Word add-in task pane.
// Same-origin routes forward the caller's FD credential. This file never holds a Synergy key.

export interface SynergyProjectHit {
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
  cache: SynergyCacheStatus;
  result_total: number;
}

/**
 * Searches the Synergy project directory cache by job number or project name.
 * Default hides inactive and archived records unless includeInactive is true.
 */
export async function searchSynergyProjects(
  query: string,
  includeInactive = false,
  limit = 20
): Promise<SynergySearchResponse> {
  const params = new URLSearchParams({
    q: query,
    include_inactive: String(includeInactive),
    limit: String(limit),
  });

  const res = await fetch(`/synergy/projects?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Authentication required for Synergy project directory.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Synergy directory error (${res.status})`);
  }

  return res.json();
}

/**
 * Logs when a signed-in user selects/opens a Synergy directory row.
 * Returns 204 No Content. Does not create or mutate anything in Synergy.
 */
export async function fetchFeeProposalPrefill(orgId: number, projectId: number): Promise<unknown> {
  const res = await fetch(`/synergy/projects/${orgId}/${projectId}/fee-proposal-prefill`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(
      res.status === 401
        ? 'Sign in with your FD account to load the Client role from the project directory.'
        : err.message || `Client role was not loaded (${res.status})`,
    ) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}

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
