import { render, screen, fireEvent } from '@testing-library/react';
import HorizontalEscapeSection from '../../components/efs/HorizontalEscapeSection';
import type { HorizontalEscapeRow } from '../../lib/efs-types';

const MAX_ROWS = 20;
const MAX_EXIT_WIDTHS = 20;

function createEmptyRow(): HorizontalEscapeRow {
  return { name: '', use: 'Warehouse', exitWidths: Array(MAX_EXIT_WIDTHS).fill('') };
}

function renderSection(overrides: { rows?: HorizontalEscapeRow[]; numRows?: number; numExitCols?: number } = {}) {
  const onChange = jest.fn();
  const rows = overrides.rows || Array.from({ length: MAX_ROWS }, createEmptyRow);
  const numRows = overrides.numRows ?? 6;
  const numExitCols = overrides.numExitCols ?? 3;
  const result = render(
    <HorizontalEscapeSection
      rows={rows}
      numRows={numRows}
      numExitCols={numExitCols}
      onChange={onChange}
      onNumRowsChange={jest.fn()}
      onNumExitColsChange={jest.fn()}
      onExitWidthChange={jest.fn()}
    />
  );
  return { ...result, onChange };
}

describe('HorizontalEscapeSection', () => {
  it('renders the correct number of area rows', () => {
    renderSection({ numRows: 3 });
    // One name input per area row — unambiguous, unlike the digit "1" which also
    // appears in the row-count and exit-column dropdown options.
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('renders Name and Use columns', () => {
    renderSection({ numRows: 1 });
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Use')).toBeInTheDocument();
  });

  it('renders exit width columns based on numExitCols', () => {
    renderSection({ numRows: 1, numExitCols: 4 });
    // Exit width column headers "Exit 1" through "Exit 4"
    expect(screen.getByText('Exit 1')).toBeInTheDocument();
    expect(screen.getByText('Exit 4')).toBeInTheDocument();
  });

  it('calls onChange when name field changes', () => {
    const { onChange } = renderSection({ numRows: 1 });
    const nameInputs = screen.getAllByRole('textbox');
    fireEvent.change(nameInputs[0], { target: { value: 'Ground Floor' } });
    expect(onChange).toHaveBeenCalledWith(0, 'name', 'Ground Floor');
  });

  it('has horizontally scrollable container', () => {
    const { container } = renderSection();
    const scrollable = container.querySelector('.overflow-x-auto');
    expect(scrollable).toBeInTheDocument();
  });
});
