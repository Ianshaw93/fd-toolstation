import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SynergyProjectPicker from '../../components/addin/SynergyProjectPicker';
import * as synergyApi from '../../lib/synergy-api';

jest.mock('../../lib/synergy-api');

const mockHits: synergyApi.SynergyProjectHit[] = [
  {
    synergy_project_id: 1001,
    organisation_id: 5466,
    label: '0657 Panattoni California Drive',
    name: 'Panattoni California Drive',
    status: 'Active',
    active: true,
  },
  {
    synergy_project_id: 1002,
    organisation_id: 5466,
    label: '0406 Former Homebase Site North Finchley',
    name: 'Former Homebase Site North Finchley',
    status: 'Active',
    active: true,
  },
  {
    synergy_project_id: 1003,
    organisation_id: 5466,
    label: '0243 St Marys Residential Phase 2',
    name: 'St Marys Residential Phase 2',
    status: 'Completed',
    active: true,
  },
  {
    synergy_project_id: 1004,
    organisation_id: 5466,
    label: '0189 Old Warehouse Conversion DSEAR',
    name: 'Old Warehouse Conversion DSEAR',
    status: 'Archived',
    active: false,
  },
];

describe('SynergyProjectPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input when unlinked', () => {
    render(<SynergyProjectPicker onSelect={jest.fn()} onUnlink={jest.fn()} />);

    expect(screen.getByPlaceholderText(/Search by job # or name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Include inactive \/ archived/i)).not.toBeChecked();
  });

  it('searches projects by query and displays formatted labels', async () => {
    (synergyApi.searchSynergyProjects as jest.Mock).mockResolvedValue({
      items: [mockHits[0]],
      cache: { stale: false, last_success_at: '2026-11-11T10:00:00Z', last_attempt_at: null, last_error: null },
      result_total: 1,
    });

    render(<SynergyProjectPicker onSelect={jest.fn()} onUnlink={jest.fn()} />);

    const input = screen.getByPlaceholderText(/Search by job # or name/i);
    fireEvent.change(input, { target: { value: '0657' } });

    await waitFor(() => {
      expect(synergyApi.searchSynergyProjects).toHaveBeenCalledWith('0657', false);
    });

    expect(await screen.findByText('0657 Panattoni California Drive')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText(/Org 5466/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Job #1001/i)).not.toBeInTheDocument();
  });

  it('passes includeInactive flag when checked', async () => {
    (synergyApi.searchSynergyProjects as jest.Mock).mockResolvedValue({
      items: [mockHits[3]],
      cache: { stale: false, last_success_at: null, last_attempt_at: null, last_error: null },
      result_total: 1,
    });

    render(<SynergyProjectPicker onSelect={jest.fn()} onUnlink={jest.fn()} />);

    const checkbox = screen.getByLabelText(/Include inactive \/ archived/i);
    fireEvent.click(checkbox);

    const input = screen.getByPlaceholderText(/Search by job # or name/i);
    fireEvent.change(input, { target: { value: 'warehouse' } });

    await waitFor(() => {
      expect(synergyApi.searchSynergyProjects).toHaveBeenCalledWith('warehouse', true);
    });

    expect(await screen.findByText('0189 Old Warehouse Conversion DSEAR')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('calls onSelect and logs open when a project hit is clicked', async () => {
    const onSelect = jest.fn();
    (synergyApi.searchSynergyProjects as jest.Mock).mockResolvedValue({
      items: [mockHits[0]],
      cache: { stale: false, last_success_at: null, last_attempt_at: null, last_error: null },
      result_total: 1,
    });

    render(<SynergyProjectPicker onSelect={onSelect} onUnlink={jest.fn()} />);

    const input = screen.getByPlaceholderText(/Search by job # or name/i);
    fireEvent.change(input, { target: { value: 'Panattoni' } });

    const item = await screen.findByText('0657 Panattoni California Drive');
    fireEvent.click(item);

    expect(onSelect).toHaveBeenCalledWith(mockHits[0]);
    expect(synergyApi.logSynergyProjectOpen).toHaveBeenCalledWith(5466, 1001, 0);
  });

  it('renders linked state with label, IDs, and allows unlinking', () => {
    const onUnlink = jest.fn();
    render(
      <SynergyProjectPicker
        selectedId={1001}
        selectedOrgId={5466}
        selectedLabel="0657 Panattoni California Drive"
        onSelect={jest.fn()}
        onUnlink={onUnlink}
      />
    );

    expect(screen.getByText('Linked Synergy Project')).toBeInTheDocument();
    expect(screen.getByText('0657 Panattoni California Drive')).toBeInTheDocument();
    expect(screen.queryByText(/Org ID 5466/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Job #1001/i)).not.toBeInTheDocument();

    const unlinkBtn = screen.getByRole('button', { name: /Change \/ Unlink/i });
    fireEvent.click(unlinkBtn);
    expect(onUnlink).toHaveBeenCalledTimes(1);
  });

  it('shows stale cache indicator when cache is marked stale', async () => {
    (synergyApi.searchSynergyProjects as jest.Mock).mockResolvedValue({
      items: [mockHits[0]],
      cache: { stale: true, last_success_at: '2026-11-10T10:00:00Z', last_attempt_at: null, last_error: null },
      result_total: 1,
    });

    render(<SynergyProjectPicker onSelect={jest.fn()} onUnlink={jest.fn()} />);

    const input = screen.getByPlaceholderText(/Search by job # or name/i);
    fireEvent.change(input, { target: { value: '0657' } });

    expect(await screen.findByText('Cache stale')).toBeInTheDocument();
  });
});
