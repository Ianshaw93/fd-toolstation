import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SharedAssumptionsSection from '../../components/warehouse-smoke/SharedAssumptionsSection';
import { DEFAULT_SHARED, type SharedField, type SharedForm } from '../../lib/smoke-layer-project';

function setup(overrides: Partial<SharedForm> = {}, invalid: SharedField[] = []) {
  const onChange = jest.fn();
  render(
    <SharedAssumptionsSection
      shared={{ ...DEFAULT_SHARED, ...overrides }}
      onChange={onChange}
      invalid={new Set(invalid)}
    />,
  );
  return { onChange };
}

describe('SharedAssumptionsSection', () => {
  it('defaults to an ultra-fast growth rate and a 2 m tenability height', () => {
    setup();
    expect(screen.getByLabelText('Fire growth rate')).toHaveValue('0.188');
    expect(screen.getByLabelText(/Tenability height/)).toHaveValue(2);
  });

  it('explains that the tenability height defines ASET', () => {
    setup();
    expect(screen.getByText(/ASET is when the layer reaches it/)).toBeInTheDocument();
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

  it('goes back to a standard rate when one is chosen again', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.selectOptions(screen.getByLabelText('Fire growth rate'), 'custom');
    await user.selectOptions(screen.getByLabelText('Fire growth rate'), '0.0117');
    expect(onChange).toHaveBeenCalledWith('fgr', '0.0117');
    expect(screen.queryByLabelText(/Growth rate coefficient/)).not.toBeInTheDocument();
  });

  it('reports edits to the tenability height', async () => {
    const { onChange } = setup({ tenabilityHeight: '' });
    await userEvent.type(screen.getByLabelText(/Tenability height/), '3');
    expect(onChange).toHaveBeenCalledWith('tenabilityHeight', '3');
  });

  it('marks a field the model rejected', () => {
    setup({}, ['detectionTime']);
    expect(screen.getByLabelText(/Detection time/)).toHaveAttribute('aria-invalid', 'true');
  });
});
