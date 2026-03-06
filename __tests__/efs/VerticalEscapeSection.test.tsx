import { render, screen, fireEvent } from '@testing-library/react';
import VerticalEscapeTable from '../../components/efs/VerticalEscapeTable';
import type { VerticalEscapeRow } from '../../lib/efs-types';

const MAX_ROWS = 20;

function createEmptyRow(): VerticalEscapeRow {
  return { stairName: '', widthMm: '', numFloorsServed: '', useServed: '', singleStairAccess: false };
}

function renderTable(overrides: { rows?: VerticalEscapeRow[] } = {}) {
  const onChange = jest.fn();
  const rows = overrides.rows || Array.from({ length: MAX_ROWS }, createEmptyRow);
  const result = render(
    <VerticalEscapeTable rows={rows} onChange={onChange} />
  );
  return { ...result, onChange };
}

describe('VerticalEscapeTable', () => {
  it('renders column headers', () => {
    renderTable();
    expect(screen.getByText('Stair Name')).toBeInTheDocument();
    expect(screen.getByText('Width (mm)')).toBeInTheDocument();
    expect(screen.getByText('No. Floors Served')).toBeInTheDocument();
    expect(screen.getByText('Use Served')).toBeInTheDocument();
    expect(screen.getByText('Single Stair Access')).toBeInTheDocument();
  });

  it('renders at least 3 visible rows by default', () => {
    renderTable();
    // Row numbers 1, 2, 3 should be visible
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onChange when stair name is entered', () => {
    const { onChange } = renderTable();
    const nameInputs = screen.getAllByPlaceholderText('e.g. Main Office Stair 1');
    fireEvent.change(nameInputs[0], { target: { value: 'Stair A' } });
    expect(onChange).toHaveBeenCalled();
    const updatedRows = onChange.mock.calls[0][0];
    expect(updatedRows[0].stairName).toBe('Stair A');
  });

  it('renders Use Served dropdown with area types', () => {
    renderTable();
    const selects = screen.getAllByRole('combobox');
    const useSelect = selects.find(s => {
      const options = Array.from((s as HTMLSelectElement).options);
      return options.some(o => o.value === 'Warehouse');
    }) as HTMLSelectElement;
    expect(useSelect).toBeTruthy();
  });

  it('renders Single Stair Access as Yes/No dropdown', () => {
    renderTable();
    const selects = screen.getAllByRole('combobox');
    const singleStairSelect = selects.find(s => {
      const options = Array.from((s as HTMLSelectElement).options);
      return options.length === 2 && options.some(o => o.value === 'Yes');
    }) as HTMLSelectElement;
    expect(singleStairSelect).toBeTruthy();
  });

  it('shows more rows when later rows are populated', () => {
    const rows = Array.from({ length: MAX_ROWS }, createEmptyRow);
    rows[4] = { stairName: 'Stair E', widthMm: 1000, numFloorsServed: 1, useServed: 'Office', singleStairAccess: false };
    renderTable({ rows });
    // Should show at least 6 rows (lastPopulated=4, +2)
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});
