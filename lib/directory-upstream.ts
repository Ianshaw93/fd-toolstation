// Server-side calls to the shared project directory. The browser never receives a Synergy key.
// A request with no FD Authorization is rejected. access_as_user is not treated as signed-in.

const DEFAULT_DIRECTORY_API_BASE = 'https://directory-api-production-7f250373.up.railway.app';

export function directoryApiBase(): string {
  return (process.env.DIRECTORY_API_BASE || DEFAULT_DIRECTORY_API_BASE).replace(/\/$/, '');
}

export function callerAuthorization(header: string | null): string | null {
  const value = header?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export function directorySearchUrl(query: string): string {
  return `${directoryApiBase()}/v1/projects${query ? `?${query}` : ''}`;
}

export function directoryPrefillUrl(ref: string): string {
  return `${directoryApiBase()}/v1/projects/${encodeURIComponent(ref)}/fee-proposal-prefill`;
}
