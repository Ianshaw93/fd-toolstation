import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RoomFireSection from '../../components/warehouse-smoke/RoomFireSection';
import { DEFAULT_FORM } from '../../lib/smoke-layer-form';

function setup(overrides: Partial<typeof DEFAULT_FORM> = {}) {
  const onChange = jest.fn();
  render(
    <RoomFireSection
      form={{ ...DEFAULT_FORM, ...overrides }}
      onChange={onChange}
      invalid={new Set()}
    />,
  );
  return { onChange };
}

describe('RoomFireSection', () => {
  it('defaults to an ultra-fast growth rate', () => {
    setup();
    expect(screen.getByLabelText('Fire growth rate')).toHaveValue('0.188');
  });

  it('shows the plan area the smoke actually fills once racking is entered', () => {
    setup({ roomArea: '43047', rackingPerc: '33' });
    expect(screen.getByText('Smoke fills 28,841 m² of plan area.')).toBeInTheDocument();
  });

  it('falls back to guidance when the area is not filled in yet', () => {
    setup({ rackingPerc: '50' });
    expect(screen.getByText(/Use 50% as standard/)).toBeInTheDocument();
  });

  it('reveals a coefficient field when the growth rate is custom', () => {
    setup({ fgr: '0.09' });
    expect(screen.getByLabelText(/Growth rate coefficient/)).toBeInTheDocument();
  });

  it('reveals the coefficient field when Custom is chosen from a standard rate', async () => {
    // Regression: selecting Custom used to be a dead end, because the value
    // still matched a standard rate so the field stayed hidden.
    const user = userEvent.setup();
    setup();
    expect(screen.queryByLabelText(/Growth rate coefficient/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Fire growth rate'), 'custom');

    expect(screen.getByLabelText(/Growth rate coefficient/)).toBeInTheDocument();
    expect(screen.getByLabelText('Fire growth rate')).toHaveValue('custom');
  });

  it('lets a custom coefficient be typed in and reported', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.selectOptions(screen.getByLabelText('Fire growth rate'), 'custom');
    await user.type(screen.getByLabelText(/Growth rate coefficient/), '5');
    expect(onChange).toHaveBeenCalledWith('fgr', '0.1885');
  });

  it('goes back to a standard rate when one is chosen again', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.selectOptions(screen.getByLabelText('Fire growth rate'), 'custom');
    await user.selectOptions(screen.getByLabelText('Fire growth rate'), '0.0117');
    expect(onChange).toHaveBeenCalledWith('fgr', '0.0117');
    expect(screen.queryByLabelText(/Growth rate coefficient/)).not.toBeInTheDocument();
  });

  it('reports edits to the floor area', async () => {
    const { onChange } = setup();
    await userEvent.type(screen.getByLabelText(/Floor area/), '5');
    expect(onChange).toHaveBeenCalledWith('roomArea', '5');
  });

  it('marks a field the model rejected', () => {
    render(
      <RoomFireSection
        form={DEFAULT_FORM}
        onChange={jest.fn()}
        invalid={new Set(['roomArea'] as const)}
      />,
    );
    expect(screen.getByLabelText(/Floor area/)).toHaveAttribute('aria-invalid', 'true');
  });
});
