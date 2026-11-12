// Project directory calls for the Word add-in task pane, through the shared FD directory
// client. Its base URL is this app's origin: the same-origin /v1 routes forward the bearer
// token to the directory API (whose CORS does not list this origin). No Synergy key here.

import { getDirectoryAccessToken } from './directory-auth';
import {
  createDirectoryClient,
  type DirectoryClient,
  type FeeProposalPrefill,
  type SearchResult,
} from './vendor/fd-directory-client';

let client: DirectoryClient | null = null;

function directory(): DirectoryClient {
  if (!client) client = createDirectoryClient({ baseUrl: window.location.origin, getAccessToken: getDirectoryAccessToken });
  return client;
}

/** Picker search: `include=inactive,archived` when the toggle is on, 20 results. */
export function searchDirectoryProjects(
  query: string,
  options: { includeInactive: boolean; signal?: AbortSignal },
): Promise<SearchResult> {
  return directory().search(query, {
    includeInactive: options.includeInactive,
    includeArchived: options.includeInactive,
    limit: 20,
    signal: options.signal,
  });
}

export function fetchFeeProposalPrefill(ref: string, signal?: AbortSignal): Promise<FeeProposalPrefill | null> {
  return directory().feeProposalPrefill(ref, signal);
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
