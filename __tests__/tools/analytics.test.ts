import {
  TOOL_SEARCH_ANON_COOKIE,
  TOOL_SEARCH_CLICK_PATH,
  TOOL_SEARCH_LOG_PATH,
  buildClickLog,
  buildSearchLog,
  ensureSearchLogged,
  getOrCreateAnonId,
  logToolSearchClick,
  resetAnalyticsState,
} from '../../lib/tools/analytics';
import { searchTools } from '../../lib/tools/search';

describe('tool-search analytics payloads', () => {
  beforeEach(() => {
    resetAnalyticsState();
    document.cookie = `${TOOL_SEARCH_ANON_COOKIE}=; path=/; max-age=0`;
  });

  it('builds a search_logs-shaped event with query, counts, top ids, and null user', () => {
    const result = searchTools('br');
    const event = buildSearchLog(result, { latencyMs: 3, anonId: 'anon-1', clientSearchId: 'search-1' });
    expect(event.clientSearchId).toBe('search-1');
    expect(event.query).toBe('br');
    expect(event.queryNormalized).toBe('br');
    expect(event.resultCount).toBeGreaterThan(3);
    expect(event.topIds).toEqual(expect.arrayContaining(['efs-calculator', 'upload-canvas-efs']));
    expect(event.confidence).toMatch(/low|medium|high/);
    expect(event.mode).toBe('keyword');
    expect(event.latencyMs).toBe(3);
    expect(event.anonId).toBe('anon-1');
    expect(event.userId).toBeNull();
    expect(event.userEmail).toBeNull();
    expect(event.source).toBe('toolstation-home');
  });

  it('records zero-result searches so we can measure miss rate', () => {
    const event = buildSearchLog(searchTools('bananas'), { anonId: 'anon-1', clientSearchId: 'search-2' });
    expect(event.resultCount).toBe(0);
    expect(event.topIds).toEqual([]);
    expect(event.suggestionId).toBeNull();
  });

  it('click payload points at the same clientSearchId and 1-based rank', () => {
    const result = searchTools('br');
    const part = result.matches.find((row) => row.id === 'upload-canvas-efs');
    expect(part).toBeDefined();
    const event = buildClickLog(part!, result, { clientSearchId: 'search-1', anonId: 'anon-1' });
    expect(event.partId).toBe('upload-canvas-efs');
    expect(event.clientSearchId).toBe('search-1');
    expect(event.rank).toBe(result.matches.findIndex((row) => row.id === 'upload-canvas-efs') + 1);
    expect(event.rank).toBeGreaterThan(0);
  });

  it('reuses one clientSearchId for the same query (debounce + click)', () => {
    const result = searchTools('7974');
    const first = ensureSearchLogged(result, { latencyMs: 1 });
    const second = ensureSearchLogged(result, { latencyMs: 1 });
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it('does not log browse / empty queries', () => {
    expect(ensureSearchLogged(searchTools(''))).toBeNull();
    expect(ensureSearchLogged(searchTools('   '))).toBeNull();
  });

  it('persists an anonymous cookie when no SSO is present', () => {
    const a = getOrCreateAnonId();
    const b = getOrCreateAnonId();
    expect(a).toBe(b);
    expect(document.cookie).toContain(TOOL_SEARCH_ANON_COOKIE);
  });
});

describe('tool-search analytics posting', () => {
  const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response));

  beforeEach(() => {
    resetAnalyticsState();
    fetchMock.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('POSTs a search log then a click that shares clientSearchId', () => {
    const result = searchTools('warehouse');
    const part = result.matches[0];
    logToolSearchClick(part, result, { latencyMs: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const searchCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const clickCall = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(searchCall[0]).toBe(TOOL_SEARCH_LOG_PATH);
    expect(clickCall[0]).toBe(TOOL_SEARCH_CLICK_PATH);

    const searchBody = JSON.parse(String(searchCall[1].body));
    const clickBody = JSON.parse(String(clickCall[1].body));
    expect(searchBody.query).toBe('warehouse');
    expect(searchBody.topIds[0]).toBe('warehouse-smoke');
    expect(clickBody.partId).toBe('warehouse-smoke');
    expect(clickBody.clientSearchId).toBe(searchBody.clientSearchId);
    expect(clickBody.rank).toBe(1);
  });
});
