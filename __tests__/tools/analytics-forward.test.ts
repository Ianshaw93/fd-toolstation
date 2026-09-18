import {
  backendOrigin,
  backendPath,
  enrichEvent,
  forwardToolSearchEvent,
  identityFromHeaders,
  isClickEvent,
  isLogEvent,
} from '../../lib/tools/analytics-forward';

describe('analytics-forward', () => {
  it('reads Entra / Easy Auth identity headers when present', () => {
    const headers = new Headers({
      'x-ms-client-principal-id': 'oid-1',
      'x-ms-client-principal-name': 'ian@firedynamics.co.uk',
    });
    expect(identityFromHeaders(headers)).toEqual({
      userId: 'oid-1',
      userEmail: 'ian@firedynamics.co.uk',
    });
  });

  it('leaves identity null when homepage SSO is absent', () => {
    expect(identityFromHeaders(new Headers())).toEqual({ userId: null, userEmail: null });
  });

  it('validates log vs click payloads', () => {
    expect(isLogEvent({ clientSearchId: 's1', query: 'br' })).toBe(true);
    expect(isLogEvent({ clientSearchId: 's1' })).toBe(false);
    expect(isClickEvent({ clientSearchId: 's1', partId: 'warehouse-smoke' })).toBe(true);
    expect(isClickEvent({ clientSearchId: 's1', query: 'br' })).toBe(false);
  });

  it('forwards to Railway /tool-search/log and never throws if the backend is down', async () => {
    const post = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    const result = await forwardToolSearchEvent(
      'log',
      { clientSearchId: 's1', query: 'br', userId: null, userEmail: null },
      new Headers(),
      post as unknown as typeof fetch,
    );
    expect(result.forwarded).toBe(false);
    expect(post).toHaveBeenCalledWith(
      `${backendOrigin()}${backendPath('log')}`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fills user fields from headers when the client sent null', () => {
    const enriched = enrichEvent(
      { clientSearchId: 's1', query: 'br', userId: null, userEmail: null },
      { userId: 'oid-1', userEmail: 'ian@firedynamics.co.uk' },
    );
    expect(enriched.userId).toBe('oid-1');
    expect(enriched.userEmail).toBe('ian@firedynamics.co.uk');
  });
});
