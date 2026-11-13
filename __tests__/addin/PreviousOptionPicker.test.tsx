import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PreviousOptionPicker from '../../components/fee-proposal/PreviousOptionPicker';

describe('PreviousOptionPicker', () => {
  it('renders pills for short fields and dispatches PICK_PREVIOUS_OPTION on click', () => {
    const dispatch = jest.fn();
    render(
      <PreviousOptionPicker
        field="names"
        label="Client name"
        synergyValue={{ firstName: 'Alice', lastName: 'Smith' }}
        previousOptions={[
          { value: { firstName: 'Jane', lastName: 'Doe' }, count: 2, latest_at: '2026-11-13T10:00:00Z', by: 'Sam Bennett' },
        ]}
        currentValue={{ firstName: 'Alice', lastName: 'Smith' }}
        dispatch={dispatch}
      />,
    );

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Synergy')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Prev fee · Sam · 2×')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Jane Doe/ }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PICK_PREVIOUS_OPTION',
      field: 'names',
      source: 'previous_fee',
      value: { firstName: 'Jane', lastName: 'Doe' },
    });
  });

  it('shows full address cards when there are 1-2 options, and compact preview with Show full when 3+', () => {
    const dispatch = jest.fn();
    const { rerender } = render(
      <PreviousOptionPicker
        field="address"
        label="Address"
        synergyValue={['10 Old Rd', 'London', 'SW1A 1AA', '', '', '']}
        previousOptions={[
          { value: ['1 High St', 'Dunstable', 'LU6 1AA'], count: 1, latest_at: '2026-11-13T10:00:00Z', by: 'Sam Bennett' },
        ]}
        currentValue={['', '', '', '', '', '']}
        dispatch={dispatch}
      />,
    );

    // 2 options -> full multiline addresses visible without needing "Show full"
    expect(screen.queryByRole('button', { name: 'Show full' })).not.toBeInTheDocument();
    expect(screen.getByText(/1 High St\s+Dunstable\s+LU6 1AA/)).toBeInTheDocument();

    const useButtons = screen.getAllByRole('button', { name: 'Use' });
    fireEvent.click(useButtons[1]);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PICK_PREVIOUS_OPTION',
      field: 'address',
      source: 'previous_fee',
      value: ['1 High St', 'Dunstable', 'LU6 1AA'],
    });

    // 3+ options -> compact preview with Show full toggle
    rerender(
      <PreviousOptionPicker
        field="address"
        label="Address"
        synergyValue={['10 Old Rd', 'London', 'SW1A 1AA', '', '', '']}
        previousOptions={[
          { value: ['1 High St', 'Dunstable', 'LU6 1AA'], count: 1, latest_at: '2026-11-13T10:00:00Z', by: 'Sam Bennett' },
          { value: ['22 Park Ave', 'Luton', 'LU1 2BB'], count: 1, latest_at: '2026-11-12T10:00:00Z', by: 'John O’Neill' },
        ]}
        currentValue={['', '', '', '', '', '']}
        dispatch={dispatch}
      />,
    );

    const toggles = screen.getAllByRole('button', { name: 'Show full' });
    expect(toggles).toHaveLength(3);
    fireEvent.click(toggles[0]);
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });
});
