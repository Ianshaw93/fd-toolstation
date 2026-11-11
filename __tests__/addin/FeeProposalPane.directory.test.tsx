import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeeProposalPane from '../../components/addin/FeeProposalPane';
import { setDirectoryAccessTokenProvider } from '../../lib/directory-auth';
import { fixtureAccessToken, LABEL_0406, pending0406, project0406, REF_0406, searchPage, served0406, served0406WithContacts, withCompanyContacts } from '../../test-fixtures/directory-contract-v1';

jest.mock('../../lib/word-addin-api', () => ({
  fetchEngineersViaProxy: jest.fn().mockResolvedValue([
    { full_name: 'Sam Bennett', email_prefix: 'sam', phone_number: '', job_title: '' },
    { full_name: 'Kirsty Cameron', email_prefix: 'kirsty', phone_number: '', job_title: '' },
  ]),
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

const SAM = { key: 'acct-sam', username: 'sam@firedynamicsgroup.com', name: 'Sam Bennett' };
const signedIn = { state: 'signed_in' as const, reason: null, account: SAM, signIn: jest.fn() };

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
    for (const line of ['The Dock', 'Station road', 'Kings Langley', 'Hertfordshire', 'WD4 8LZ', 'United Kingdom']) {
      expect(screen.getByDisplayValue(line)).toBeInTheDocument();
    }
    expect(screen.getByTestId('address-review')).toHaveTextContent(/home address slot/i);
    expect(screen.queryByRole('status')).toBeNull();

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
    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={{ state: 'needs_sign_in', reason: null, account: null, signIn: jest.fn() }} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    expect(await screen.findByText(/Sign in with Microsoft to search/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/v1/'))).toBe(false));
  });

  it('defaults the engineer to the signed-in person and keeps a manual change through the prefill poll', async () => {
    const prefills = [pending0406(), served0406()];
    global.fetch = jest.fn(async (url: string) => {
      const path = new URL(url, 'http://localhost').pathname;
      if (path === '/v1/projects') return json(searchPage([project0406()]));
      if (path.endsWith('/fee-proposal-prefill')) return json(prefills.shift());
      return json(null, 204);
    }) as unknown as typeof fetch;
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken());

    const { rerender } = render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={signedIn} />);
    const engineer = (await screen.findByDisplayValue('Sam Bennett')) as HTMLSelectElement;
    expect(engineer.tagName).toBe('SELECT');
    expect(Array.from(engineer.options).map((o) => o.value)).toEqual(['', 'Sam Bennett', 'Kirsty Cameron']);

    await userEvent.selectOptions(engineer, 'Kirsty Cameron');
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    await userEvent.click(await screen.findByText(LABEL_0406));
    expect(await screen.findByDisplayValue('Taylor Wimpey North Thames', {}, { timeout: 5000 })).toBeInTheDocument();
    rerender(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={{ ...signedIn }} />);
    expect(engineer.value).toBe('Kirsty Cameron');
  }, 10000);

  it('leaves the engineer unselected with a hint when the signed-in person is not on the list', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    const guest = { ...signedIn, account: { key: 'g', username: 'visitor@firedynamicsgroup.com', name: 'Visiting Engineer' } };
    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={guest} />);
    expect(await screen.findByText(/Visiting Engineer is not on the engineer list/i)).toBeInTheDocument();
    const select = screen.getByDisplayValue('Select Engineer') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'Sam Bennett', 'Kirsty Cameron']);
  });

  it('shows the company people as name tags and fills first name and surname only when one is clicked', async () => {
    const prefills = [pending0406(), served0406WithContacts()];
    global.fetch = jest.fn(async (url: string) => {
      const path = new URL(url, 'http://localhost').pathname;
      if (path === '/v1/projects') return json(searchPage([project0406()]));
      if (path.endsWith('/fee-proposal-prefill')) return json(prefills.shift() ?? served0406WithContacts());
      return json(null, 204);
    }) as unknown as typeof fetch;
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken());

    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={signedIn} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    await userEvent.click(await screen.findByText(LABEL_0406));

    const group = await screen.findByRole('group', { name: 'Total Synergy contacts at Taylor Wimpey North Thames' }, { timeout: 5000 });
    const tags = Array.from(group.querySelectorAll('button')).map((b) => b.textContent);
    expect(tags).toEqual(['Louie Sharp', 'Matt Christensen', 'Tyler Watkins']);
    const firstName = screen.getByLabelText('First Name') as HTMLInputElement;
    const surname = screen.getByLabelText('Surname') as HTMLInputElement;
    expect(firstName.value).toBe('');
    expect(screen.getByRole('button', { name: 'Louie Sharp' })).toHaveAttribute('aria-pressed', 'false');

    screen.getByRole('button', { name: 'Matt Christensen' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(firstName.value).toBe('Matt');
    expect(surname.value).toBe('Christensen');
    expect(screen.getByRole('button', { name: 'Matt Christensen' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByDisplayValue('Taylor Wimpey North Thames')).toBeInTheDocument();

    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Matthew');
    expect(firstName.value).toBe('Matthew');
    expect(screen.getByRole('button', { name: 'Matt Christensen' })).toHaveAttribute('aria-pressed', 'false');
  }, 10000);

  it('has no name tags when the directory sends no company people', async () => {
    global.fetch = jest.fn(async (url: string) => {
      const path = new URL(url, 'http://localhost').pathname;
      if (path === '/v1/projects') return json(searchPage([project0406()]));
      if (path.endsWith('/fee-proposal-prefill')) return json(served0406());
      return json(null, 204);
    }) as unknown as typeof fetch;
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken());
    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={signedIn} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    await userEvent.click(await screen.findByText(LABEL_0406));
    expect(await screen.findByDisplayValue('Taylor Wimpey North Thames')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Total Synergy contacts/ })).toBeNull();
    expect(screen.getByLabelText('First Name')).toHaveValue('');
  });

  it('labels each filled field in words and switches to "Edited by you" after a manual change', async () => {
    const prefills = [pending0406(), served0406WithContacts()];
    global.fetch = jest.fn(async (url: string) => {
      const path = new URL(url, 'http://localhost').pathname;
      if (path === '/v1/projects') return json(searchPage([project0406()]));
      if (path.endsWith('/fee-proposal-prefill')) return json(prefills.shift() ?? served0406WithContacts());
      return json(null, 204);
    }) as unknown as typeof fetch;
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken());

    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={signedIn} />);
    expect(await screen.findByTestId('source-engineer')).toHaveTextContent('From Microsoft sign-in');
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    await userEvent.click(await screen.findByText(LABEL_0406));
    expect(await screen.findByTestId('source-company', {}, { timeout: 5000 })).toHaveTextContent('From Total Synergy');
    expect(screen.getByTestId('source-address')).toHaveTextContent(/From Total Synergy.*check/i);
    expect(screen.getByTestId('address-review')).toHaveTextContent(/home address slot/i);
    expect(screen.getByTestId('source-project-name')).toHaveTextContent('From Total Synergy');
    expect(screen.queryByTestId('source-names')).toBeNull();
    expect(screen.queryByTestId('source-country')).toBeNull();
    expect(screen.getByTestId('autofill-announcement')).toHaveTextContent('Filled from Total Synergy: company, address (check it), project name.');

    await userEvent.click(screen.getByRole('button', { name: 'Louie Sharp' }));
    expect(screen.getByTestId('source-names')).toHaveTextContent('Selected company contact');

    const company = screen.getByDisplayValue('Taylor Wimpey North Thames');
    await userEvent.type(company, ' Ltd');
    expect(screen.getByTestId('source-company')).toHaveTextContent('Edited by you');
    expect(screen.getByTestId('source-company')).toHaveTextContent(/was from Total Synergy/i);
    await userEvent.selectOptions(screen.getByDisplayValue('Sam Bennett'), 'Kirsty Cameron');
    expect(screen.getByTestId('source-engineer')).toHaveTextContent('Edited by you');
  }, 10000);

  it('says the company people are loading, then that they could not be loaded, and keeps names typeable', async () => {
    const prefills = [served0406(), withCompanyContacts(served0406(), { lookup: 'failed', errorCode: 'synergy_timeout' })];
    global.fetch = jest.fn(async (url: string) => {
      const path = new URL(url, 'http://localhost').pathname;
      if (path === '/v1/projects') return json(searchPage([project0406()]));
      if (path.endsWith('/fee-proposal-prefill')) return json(prefills.shift());
      return json(null, 204);
    }) as unknown as typeof fetch;
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken());
    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={signedIn} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    await userEvent.click(await screen.findByText(LABEL_0406));
    expect(await screen.findByTestId('company-contacts-status')).toHaveTextContent(/Looking up people at Taylor Wimpey North Thames/i);
    expect(await screen.findByText(/could not be loaded \(synergy_timeout\)/i, {}, { timeout: 5000 })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('First Name'), 'Ada');
    expect(screen.getByLabelText('First Name')).toHaveValue('Ada');
  }, 10000);

  it('says when the company people list was cut short', async () => {
    global.fetch = jest.fn(async (url: string) => {
      const path = new URL(url, 'http://localhost').pathname;
      if (path === '/v1/projects') return json(searchPage([project0406()]));
      if (path.endsWith('/fee-proposal-prefill')) {
        const body = served0406WithContacts();
        body.client.companyContacts.truncated = true;
        return json(body);
      }
      return json(null, 204);
    }) as unknown as typeof fetch;
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken());
    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={signedIn} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    await userEvent.click(await screen.findByText(LABEL_0406));
    expect(await screen.findByTestId('company-contacts-status')).toHaveTextContent(/not everyone at the company is listed/i);
  });
});
