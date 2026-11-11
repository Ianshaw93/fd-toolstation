import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeeProposalPane from '../../components/addin/FeeProposalPane';
import { setDirectoryAccessTokenProvider } from '../../lib/directory-auth';
import { fixtureAccessToken, LABEL_0406, pending0406, project0406, REF_0406, searchPage, served0406 } from '../../test-fixtures/directory-contract-v1';

jest.mock('../../lib/word-addin-api', () => ({
  fetchEngineersViaProxy: jest.fn().mockResolvedValue([{ full_name: 'Sam Bennett' }]),
  renderFeeProposal: jest.fn(),
}));

function json(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const signedIn = { state: 'signed_in' as const, reason: null, signIn: jest.fn() };

describe('Word fee pane: choosing 0406 fills the Client-role company', () => {
  const previous = global.fetch;
  afterEach(() => {
    global.fetch = previous;
    setDirectoryAccessTokenProvider(null);
  });

  it('searches, selects, waits out the pending lookup, and fills company and address', async () => {
    const prefills = [pending0406(), served0406()];
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      void init;
      const path = new URL(url, 'http://localhost').pathname;
      if (path === '/v1/projects') return json(searchPage([project0406()]));
      if (path === `/v1/projects/${encodeURIComponent(REF_0406)}/fee-proposal-prefill`) return json(prefills.shift());
      if (path.endsWith('/open')) return json(null, 204);
      throw new Error(`unexpected ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken());

    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={signedIn} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    await userEvent.click(await screen.findByText(LABEL_0406));

    expect(await screen.findByRole('status')).toHaveTextContent(/looking up/i);
    expect(await screen.findByDisplayValue('Taylor Wimpey North Thames', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByDisplayValue('The Dock,')).toBeInTheDocument();
    expect(screen.getByDisplayValue('WD4 8LZ')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/home address slot/i);

    const directoryCalls = fetchMock.mock.calls.filter(([url]) => new URL(url, 'http://localhost').pathname.startsWith('/v1/'));
    expect(directoryCalls).toHaveLength(3);
    expect(new URL(directoryCalls[0][0], 'http://localhost').search).toBe('?q=0406&limit=20');
    for (const [, init] of directoryCalls) {
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toMatch(/^Bearer /);
      expect(init?.credentials).toBe('omit');
    }
  }, 10000);

  it('fails closed without an FD session and sends nothing to the directory', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={{ state: 'needs_sign_in', reason: null, signIn: jest.fn() }} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    expect(await screen.findByText(/Sign in with Microsoft to search/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/v1/'))).toBe(false));
  });
});
