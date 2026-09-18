import { normalize } from './search';
import type { ToolPart, ToolSearchResult } from './types';

/**
 * Tool-search analytics — same job as email-search `search_logs` + `search_clicks`.
 *
 * Browser POSTs go to backendForNextApp (Misc Tools Postgres) using the same
 * `NEXT_PUBLIC_API_URL` pattern as EFS / warehouse smoke:
 *   POST {API}/tool-search/log
 *   POST {API}/tool-search/click
 * Failures (including 404 while that backend PR is still landing) are swallowed
 * so ranking / open UX never waits on analytics.
 *
 * Homepage Profile/Logout are decorative (no SSO). userId / userEmail stay
 * null until Entra is wired; sessions use cookie `fd_tool_search_anon`.
 */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://backendfornextapp-production.up.railway.app'
).replace(/\/$/, '');

export const TOOL_SEARCH_ANON_COOKIE = 'fd_tool_search_anon';
export const TOOL_SEARCH_LOG_PATH = `${API_URL}/tool-search/log`;
export const TOOL_SEARCH_CLICK_PATH = `${API_URL}/tool-search/click`;
export const TOOL_SEARCH_DEBOUNCE_MS = 400;
const TOP_IDS_MAX = 20;

export interface ToolSearchLogEvent {
  clientSearchId: string;
  query: string;
  queryNormalized: string;
  resultCount: number;
  topIds: string[];
  suggestionId: string | null;
  confidence: ToolSearchResult['confidence'];
  mode: ToolSearchResult['mode'];
  latencyMs: number | null;
  anonId: string;
  userId: string | null;
  userEmail: string | null;
  source: 'toolstation-home';
  ts: string;
}

export interface ToolSearchClickEvent {
  clientSearchId: string;
  partId: string;
  rank: number;
  anonId: string;
  userId: string | null;
  userEmail: string | null;
  source: 'toolstation-home';
  ts: string;
}

type CurrentSearch = { query: string; id: string };

let current: CurrentSearch | null = null;

export function newClientSearchId(): string {
  return crypto.randomUUID();
}

export function getOrCreateAnonId(): string {
  if (typeof document === 'undefined') return newClientSearchId();
  const existing = readCookie(TOOL_SEARCH_ANON_COOKIE);
  if (existing) return existing;
  const id = newClientSearchId();
  document.cookie = `${TOOL_SEARCH_ANON_COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax`;
  return id;
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const hit = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : null;
}

export function buildSearchLog(
  result: ToolSearchResult,
  extra: { latencyMs?: number | null; clientSearchId?: string; anonId?: string } = {},
): ToolSearchLogEvent {
  return {
    clientSearchId: extra.clientSearchId ?? newClientSearchId(),
    query: result.query,
    queryNormalized: normalize(result.query),
    resultCount: result.matches.length,
    topIds: result.matches.slice(0, TOP_IDS_MAX).map((part) => part.id),
    suggestionId: result.suggestion?.part.id ?? null,
    confidence: result.confidence,
    mode: result.mode,
    latencyMs: extra.latencyMs ?? null,
    anonId: extra.anonId ?? getOrCreateAnonId(),
    userId: null,
    userEmail: null,
    source: 'toolstation-home',
    ts: new Date().toISOString(),
  };
}

export function buildClickLog(
  part: ToolPart,
  result: ToolSearchResult,
  extra: { clientSearchId: string; anonId?: string },
): ToolSearchClickEvent {
  const rank = result.matches.findIndex((row) => row.id === part.id) + 1;
  return {
    clientSearchId: extra.clientSearchId,
    partId: part.id,
    rank,
    anonId: extra.anonId ?? getOrCreateAnonId(),
    userId: null,
    userEmail: null,
    source: 'toolstation-home',
    ts: new Date().toISOString(),
  };
}

export function resetAnalyticsState(): void {
  current = null;
}

async function postJson(path: string, body: unknown): Promise<void> {
  if (typeof fetch === 'undefined') return;
  try {
    await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Analytics must never break search.
  }
}

export function ensureSearchLogged(
  result: ToolSearchResult,
  extra: { latencyMs?: number | null } = {},
): string | null {
  if (result.mode === 'browse' || !result.query.trim()) {
    current = null;
    return null;
  }
  if (current?.query === result.query) return current.id;
  const event = buildSearchLog(result, extra);
  current = { query: result.query, id: event.clientSearchId };
  void postJson(TOOL_SEARCH_LOG_PATH, event);
  return event.clientSearchId;
}

export function logToolSearchClick(part: ToolPart, result: ToolSearchResult, extra: { latencyMs?: number | null } = {}): void {
  const clientSearchId = ensureSearchLogged(result, extra);
  if (!clientSearchId) return;
  void postJson(TOOL_SEARCH_CLICK_PATH, buildClickLog(part, result, { clientSearchId }));
}
