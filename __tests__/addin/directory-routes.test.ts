/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET as searchProjects } from '../../app/synergy/projects/route';
import { GET as prefill } from '../../app/synergy/projects/[orgId]/[projectId]/fee-proposal-prefill/route';

describe('authenticated directory routes', () => {
  const previous = global.fetch;

  afterEach(() => {
    global.fetch = previous;
  });

  it('does not serve the invented project list when nobody is signed in', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await searchProjects(new NextRequest('http://localhost/synergy/projects?q=0406'));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('sign_in_required');
    expect(JSON.stringify(body)).not.toContain('Sarah');
    expect(JSON.stringify(body)).not.toContain('no_documented_project_contacts_read');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the caller credential to the directory prefill and does not add a key', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ company_name: { value: 'SYNTH Client Ltd', status: 'present', source: 'client_role' } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await prefill(
      new NextRequest('http://localhost/synergy/projects/5466/2694397/fee-proposal-prefill', {
        headers: { Authorization: 'Bearer caller-session' },
      }),
      { params: Promise.resolve({ orgId: '5466', projectId: '2694397' }) },
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://directory-api-production-7f250373.up.railway.app/v1/projects/2694397/fee-proposal-prefill');
    expect(init.headers.Authorization).toBe('Bearer caller-session');
    expect(JSON.stringify(init.headers)).not.toMatch(/TOTAL_SYNERGY|SYNERGY_ACCESS/);
  });
});
