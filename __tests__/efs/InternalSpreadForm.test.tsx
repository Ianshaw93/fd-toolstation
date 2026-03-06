import { render, screen, fireEvent } from '@testing-library/react';
import InternalSpreadForm, { createInitialInternalSpreadData } from '../../components/efs/InternalSpreadForm';
import { INTERNAL_SPREAD_ELEMENTS } from '../../lib/efs-types';
import type { InternalSpreadData } from '../../lib/efs-types';

function renderForm(overrides: Partial<InternalSpreadData> = {}) {
  const onChange = jest.fn();
  const data = { ...createInitialInternalSpreadData(), ...overrides };
  const result = render(
    <InternalSpreadForm data={data} onChange={onChange} />
  );
  return { ...result, onChange, data };
}

describe('InternalSpreadForm', () => {
  it('renders fire separation question', () => {
    renderForm();
    expect(screen.getByText('Is Fire Separation Required between Uses?')).toBeInTheDocument();
  });

  it('renders structural fire engineering question', () => {
    renderForm();
    expect(screen.getByText(/Will structural fire engineering/)).toBeInTheDocument();
  });

  it('shows fire resistance period when separation is required', () => {
    renderForm({ fireSeparationRequired: true });
    expect(screen.getByText(/To what period of fire resistance/)).toBeInTheDocument();
  });

  it('hides fire resistance period when separation is not required', () => {
    renderForm({ fireSeparationRequired: false });
    expect(screen.queryByText(/To what period of fire resistance/)).not.toBeInTheDocument();
  });

  it('renders all internal spread elements', () => {
    renderForm();
    for (const element of INTERNAL_SPREAD_ELEMENTS) {
      expect(screen.getByText(element)).toBeInTheDocument();
    }
  });

  it('calls onChange when an element present status changes', () => {
    const { onChange } = renderForm();
    // Find the first element's select (after the top-section selects)
    const selects = screen.getAllByRole('combobox');
    // The elements table selects start after the 3 top selects (separation, period, structural)
    const firstElementSelect = selects[3];
    fireEvent.change(firstElementSelect, { target: { value: 'Yes' } });
    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls[0][0] as InternalSpreadData;
    expect(updated.elementsPresent[INTERNAL_SPREAD_ELEMENTS[0]]).toBe(true);
  });

  it('calls onChange when fire separation toggle changes', () => {
    const { onChange } = renderForm({ fireSeparationRequired: true });
    const selects = screen.getAllByRole('combobox');
    // First select is fire separation required
    fireEvent.change(selects[0], { target: { value: 'No' } });
    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls[0][0] as InternalSpreadData;
    expect(updated.fireSeparationRequired).toBe(false);
  });
});
