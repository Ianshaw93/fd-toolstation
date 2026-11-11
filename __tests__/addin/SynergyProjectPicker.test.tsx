import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SynergyProjectPicker from '../../components/addin/SynergyProjectPicker';
import * as directoryApi from '../../lib/synergy-api';
import { project0406, searchPage, LABEL_0406 } from '../../test-fixtures/directory-contract-v1';

jest.mock('../../lib/synergy-api');

const search = directoryApi.searchDirectoryProjects as jest.Mock;

function inactiveArchivedMissing() {
  const base = project0406();
  return [
    { ...base, id: 'synergy:5466:11', label: '0011 Old Inactive', isActive: false },
    { ...base, id: 'synergy:5466:12', label: '0012 Old Archived', isArchived: true },
    { ...base, id: 'synergy:5466:13', label: '0013 Gone', missingSince: '2026-10-01T00:00:00.000Z' },
  ];
}

describe('SynergyProjectPicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('waits for two characters before searching', async () => {
    search.mockResolvedValue(searchPage([]));
    render(<SynergyProjectPicker onSelect={jest.fn()} onUnlink={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0');
    await new Promise((r) => setTimeout(r, 400));
    expect(search).not.toHaveBeenCalled();
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '4');
    await waitFor(() => expect(search).toHaveBeenCalledWith('04', { includeInactive: false }));
  });

  it('shows each label verbatim and passes the include toggle', async () => {
    search.mockResolvedValue(searchPage([project0406()]));
    render(<SynergyProjectPicker onSelect={jest.fn()} onUnlink={jest.fn()} />);
    await userEvent.click(screen.getByLabelText(/Include inactive \/ archived/i));
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    expect(await screen.findByText(LABEL_0406)).toBeInTheDocument();
    expect(search).toHaveBeenLastCalledWith('0406', { includeInactive: true });
  });

  it('marks inactive, archived and missing projects instead of hiding them', async () => {
    search.mockResolvedValue(searchPage(inactiveArchivedMissing()));
    render(<SynergyProjectPicker onSelect={jest.fn()} onUnlink={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '00');
    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Missing in Synergy')).toBeInTheDocument();
  });

  it('shows the stale-sync marker from meta.stale', async () => {
    search.mockResolvedValue(searchPage([project0406()], true));
    render(<SynergyProjectPicker onSelect={jest.fn()} onUnlink={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    expect(await screen.findByText(/Directory sync is stale/i)).toBeInTheDocument();
  });

  it('hands the selected project to the form', async () => {
    search.mockResolvedValue(searchPage([project0406()]));
    const onSelect = jest.fn();
    render(<SynergyProjectPicker onSelect={onSelect} onUnlink={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/Search by job # or name/i), '0406');
    await userEvent.click(await screen.findByText(LABEL_0406));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'synergy:5466:2694397' }));
  });

  it('shows the linked project and unlinks', async () => {
    const onUnlink = jest.fn();
    render(<SynergyProjectPicker selectedRef="synergy:5466:2694397" selectedLabel={LABEL_0406} onSelect={jest.fn()} onUnlink={onUnlink} />);
    expect(screen.getByText(LABEL_0406)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Change \/ Unlink/i));
    expect(onUnlink).toHaveBeenCalled();
  });

  it('offers Microsoft sign-in when the FD session needs it, and reports why sign-in is unavailable', async () => {
    const signIn = jest.fn().mockResolvedValue('signed_in');
    const { rerender } = render(
      <SynergyProjectPicker onSelect={jest.fn()} onUnlink={jest.fn()} signIn={{ state: 'needs_sign_in', reason: null, signIn }} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Sign in with Microsoft/i }));
    expect(signIn).toHaveBeenCalled();
    rerender(
      <SynergyProjectPicker
        onSelect={jest.fn()}
        onUnlink={jest.fn()}
        signIn={{ state: 'unavailable', reason: 'This Word does not support NestedAppAuth 1.1.', signIn }}
      />,
    );
    expect(screen.getByText(/NestedAppAuth 1\.1/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sign in with Microsoft/i })).toBeNull();
  });
});
