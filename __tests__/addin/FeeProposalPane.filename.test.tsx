import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeeProposalPane from '../../components/addin/FeeProposalPane';
import { setDirectoryAccessTokenProvider } from '../../lib/directory-auth';
import { buildFeeProposalFilename } from '../../lib/fee-proposal-filename';
import { applySuggestedDocumentTitle, wordDocumentUrl } from '../../lib/word-ops';
import { fixtureAccessToken, searchPage, served0406WithContacts } from '../../test-fixtures/directory-contract-v1';
import type { DirectoryProject } from '../../lib/vendor/fd-directory-client';

jest.mock('../../lib/word-addin-api', () => ({
  fetchEngineersViaProxy: jest.fn().mockResolvedValue([]),
  renderFeeProposal: jest.fn(),
}));

jest.mock('../../lib/word-ops', () => {
  const actual = jest.requireActual('../../lib/word-ops');
  return {
    ...actual,
    applySuggestedDocumentTitle: jest.fn(async () => 'unsupported'),
  };
});

const applyTitle = applySuggestedDocumentTitle as jest.MockedFunction<typeof applySuggestedDocumentTitle>;

function json(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function project(partial: Pick<DirectoryProject, 'id' | 'synergyProjectId' | 'label' | 'numberFormatted' | 'name'>): DirectoryProject {
  return {
    organisationId: 5466,
    projectNumber: partial.numberFormatted,
    status: { name: 'In Progress', id: '2', typeId: '1' },
    isActive: true,
    isArchived: false,
    manager: null,
    primaryContact: null,
    office: null,
    projectType: null,
    tags: [],
    sourceUpdatedAt: null,
    syncedAt: '2026-11-12T09:00:00.000Z',
    missingSince: null,
    ...partial,
  };
}

const BRICK = project({
  id: 'synergy:5466:602',
  synergyProjectId: 602,
  label: '0602 Brick House Farm',
  numberFormatted: '0602',
  name: 'Brick: House/Farm',
});

const RIVERSIDE = project({
  id: 'synergy:5466:701',
  synergyProjectId: 701,
  label: '0701 Riverside School',
  numberFormatted: '0701',
  name: 'Riverside School',
});

function prefillFor(item: DirectoryProject) {
  const body = served0406WithContacts();
  body.project = { id: item.id, label: item.label, isActive: true, missingSince: null };
  body.fields.projectName = { value: item.name, status: 'from_synergy', source: 'Projects/Index.name' };
  body.client.contactSuggestions = [];
  return body;
}

const signedIn = {
  state: 'signed_in' as const,
  reason: null,
  account: { key: 'acct-sam', username: 'sam@firedynamicsgroup.com', name: 'Sam Bennett' },
  signIn: jest.fn(),
};

function installFetch() {
  global.fetch = jest.fn(async (url: string) => {
    const parsed = new URL(url, 'http://localhost');
    if (parsed.pathname === '/v1/projects') {
      const q = parsed.searchParams.get('q');
      if (q === '0701') return json(searchPage([RIVERSIDE]));
      return json(searchPage([BRICK]));
    }
    if (parsed.pathname.endsWith('/fee-proposal-prefill')) {
      const id = decodeURIComponent(parsed.pathname.split('/')[3] ?? '');
      const item = id === RIVERSIDE.id ? RIVERSIDE : BRICK;
      return json(prefillFor(item));
    }
    return json(null, 204);
  }) as unknown as typeof fetch;
}

async function link(label: string, query: string) {
  await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), query);
  await userEvent.click(await screen.findByText(label));
}

describe('Word fee pane suggested filename', () => {
  const previous = global.fetch;
  const officeGlobal = globalThis as unknown as { Office?: unknown };

  beforeEach(() => {
    applyTitle.mockClear();
    setDirectoryAccessTokenProvider(async () => fixtureAccessToken());
    installFetch();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    global.fetch = previous;
    setDirectoryAccessTokenProvider(null);
    delete officeGlobal.Office;
  });

  it('shows a sanitised suggested filename and copies it', async () => {
    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={signedIn} />);
    await link('0602 Brick House Farm', '0602');

    const expected = buildFeeProposalFilename({ numberFormatted: '0602', projectName: 'Brick: House/Farm' });
    expect(expected).toMatch(/^0602 Brick House Farm Fire Dynamics Group Fee Proposal \d{2}-\d{2}-\d{2}$/);
    expect(await screen.findByTestId('suggested-filename')).toHaveTextContent(expected);
    expect(screen.getByTestId('suggested-filename-note')).toHaveTextContent(/use it as the filename when you save/i);
    expect(applyTitle).not.toHaveBeenCalled();

    const projectName = screen.getByDisplayValue('Brick: House/Farm');
    await userEvent.clear(projectName);
    await userEvent.type(projectName, 'Typed name');
    expect(screen.getByTestId('suggested-filename')).toHaveTextContent(expected);
    expect(screen.getByTestId('suggested-filename')).not.toHaveTextContent('Typed name');

    await userEvent.click(screen.getByRole('button', { name: 'Copy suggested filename' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expected);
    expect(await screen.findByRole('button', { name: 'Copied suggested filename' })).toBeInTheDocument();
  }, 15000);

  it('hides the suggestion on unlink and shows the new project after a change', async () => {
    render(<FeeProposalPane inWord={false} busy={null} run={jest.fn()} signIn={signedIn} />);
    await link('0602 Brick House Farm', '0602');
    expect(await screen.findByTestId('suggested-filename')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Change \/ Unlink/i }));
    expect(screen.queryByTestId('suggested-filename')).toBeNull();

    await link('0701 Riverside School', '0701');
    const expected = buildFeeProposalFilename({ numberFormatted: '0701', projectName: 'Riverside School' });
    expect(await screen.findByTestId('suggested-filename')).toHaveTextContent(expected);
  }, 15000);

  it('sets the document Title when a project is linked inside Word, and says when the file is already saved', async () => {
    officeGlobal.Office = { context: { document: { url: 'https://contoso.sharepoint.com/sites/fd/Document.docx' } } };
    expect(wordDocumentUrl()).toBe('https://contoso.sharepoint.com/sites/fd/Document.docx');
    render(<FeeProposalPane inWord={true} busy={null} run={jest.fn()} signIn={signedIn} />);
    await link('0602 Brick House Farm', '0602');

    const expected = buildFeeProposalFilename({ numberFormatted: '0602', projectName: 'Brick: House/Farm' });
    await waitFor(() => expect(applyTitle).toHaveBeenCalledWith(expected));
    expect(screen.getByTestId('suggested-filename-note')).toHaveTextContent(/already saved/i);

    await userEvent.click(screen.getByRole('button', { name: /Change \/ Unlink/i }));
    await link('0701 Riverside School', '0701');
    const next = buildFeeProposalFilename({ numberFormatted: '0701', projectName: 'Riverside School' });
    await waitFor(() => expect(applyTitle).toHaveBeenCalledWith(next));
    expect(applyTitle).not.toHaveBeenCalledWith(expect.stringMatching(/Typed/));
  }, 15000);

  it('tells an unsaved Word document that Save As will suggest the name', async () => {
    officeGlobal.Office = { context: { document: { url: '' } } };
    render(<FeeProposalPane inWord={true} busy={null} run={jest.fn()} signIn={signedIn} />);
    await link('0602 Brick House Farm', '0602');
    expect(await screen.findByTestId('suggested-filename-note')).toHaveTextContent(/suggest this name when you save/i);
    expect(screen.getByTestId('suggested-filename-note')).not.toHaveTextContent(/already saved/i);
  }, 15000);
});
