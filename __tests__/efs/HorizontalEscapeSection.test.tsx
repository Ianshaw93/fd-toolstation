import { render, screen, fireEvent } from '@testing-library/react';
import HorizontalEscapeSection from '../../components/efs/HorizontalEscapeSection';
import type { HorizontalEscapeRow } from '../../lib/efs-types';

const MAX_ROWS = 20;
const MAX_EXIT_COLS = 20;

function createEmptyRow(): HorizontalEscapeRow {
  return { name: '', use: 'Warehouse', exitWidths: Array(MAX_EXIT_COLS).fill('') };
}

function renderSection(overrides: { rows?: HorizontalEscapeRow[]; numRows?: number; numExitCols?: number } = {}) {
  const onChange = jest.fn();
  const onExitWidthChange = jest.fn();
  const rows = overrides.rows || Array.from({ length: MAX_ROWS }, createEmptyRow);
  const numRows = overrides.numRows ?? 6;
  const numExitCols = overrides.numExitCols ?? 3;
  const result = render(
    <HorizontalEscapeSection
      rows={rows}
      numRows={numRows}
      numExitCols={numExitCols}
      onChange={onChange}
      onExitWidthChange={onExitWidthChange}
      onNumRowsChange={jest.fn()}
      onNumExitColsChange={jest.fn()}
    />
  );
  return { ...result, onChange, onExitWidthChange };
}

describe('HorizontalEscapeSection', () => {
  it('renders the correct number of area rows', () => {
    renderSection({ numRows: 3 });
    // One numbered body row per area, after the header row.
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '4' })).not.toBeInTheDocument();
  });

  it('renders Name and Use columns', () => {
    renderSection({ numRows: 1 });
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Use')).toBeInTheDocument();
  });

  it('renders exit width columns based on numExitCols', () => {
    renderSection({ numRows: 1, numExitCols: 4 });
    expect(screen.getByText('Exit 1')).toBeInTheDocument();
    expect(screen.getByText('Exit 4')).toBeInTheDocument();
    expect(screen.queryByText('Exit 5')).not.toBeInTheDocument();
  });

  it('calls onChange when name field changes', () => {
    const { onChange } = renderSection({ numRows: 1 });
    const nameInputs = screen.getAllByRole('textbox');
    fireEvent.change(nameInputs[0], { target: { value: 'Ground Floor' } });
    expect(onChange).toHaveBeenCalledWith(0, 'name', 'Ground Floor');
  });

  it('reports an exit width by row and column as a number', () => {
    const { onExitWidthChange } = renderSection({ numRows: 1, numExitCols: 2 });
    const widths = screen.getAllByRole('spinbutton');
    fireEvent.change(widths[1], { target: { value: '1.2' } });
    expect(onExitWidthChange).toHaveBeenCalledWith(0, 1, 1.2);
  });

  it('has horizontally scrollable container', () => {
    const { container } = renderSection();
    const scrollable = container.querySelector('.overflow-x-auto');
    expect(scrollable).toBeInTheDocument();
  });
});
