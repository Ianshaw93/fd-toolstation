import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeeProposalPane from '../../components/addin/FeeProposalPane';
import { setDirectoryAccessTokenProvider } from '../../lib/directory-auth';
import { done0406, fixtureAccessToken, LABEL_0406, pending0406, REF_0406 } from '../../test-fixtures/directory-prefill-0406';

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

describe('Word fee pane: choosing 0406 fills the Client-role company', () => {
  const previous = global.fetch;
  afterEach(() => {
    global.fetch = previous;
    setDirectoryAccessTokenProvider(null);
  });

  it('searches, selects, waits out the pending client lookup, and fills company and address', async () => {
    const prefills = [pending0406(), done0406()];
    const fetchMock = jest.fn(async (url: string, _init?: RequestInit) => {
      if (url.startsWith('/synergy/projects?')) {
        return json({ items: [{ id: REF_0406, label: LABEL_0406, isActive: true, missingSince: null }] });
      }
      if (url === '/synergy/projects/5466/2694397/fee-proposal-prefill') return json(prefills.shift());
      if (url.endsWith('/open')) return json(null, 204);
      throw new Error(`unexpected ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken());

    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    await userEvent.click(await screen.findByText(LABEL_0406));

    expect(await screen.findByRole('status')).toHaveTextContent(/looking up/i);
    expect(await screen.findByDisplayValue('Taylor Wimpey North Thames', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByDisplayValue('The Dock,')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Station road, Kings Langley')).toBeInTheDocument();
    expect(screen.getByDisplayValue('WD4 8LZ')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/needs review/i);

    const prefillCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('fee-proposal-prefill'));
    expect(prefillCalls).toHaveLength(2);
    for (const [, init] of prefillCalls as unknown as [string, RequestInit][]) {
      expect((init.headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
    }
    const searchInit = fetchMock.mock.calls[0][1] as unknown as RequestInit;
    expect((searchInit.headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
  }, 10000);

  it('fails closed without an FD sign-in and sends nothing to the directory', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    expect(await screen.findByText(/sign-?in/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/synergy'))).toBe(false));
  });
});
