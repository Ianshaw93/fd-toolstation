import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BuildingCard from '../../components/warehouse-smoke/BuildingCard';
import { newBuilding, type BuildingField, type BuildingForm } from '../../lib/smoke-layer-project';

function setup({
  building = {},
  missing = [],
  invalid = [],
  derivedExitWidth = null,
  canRemove = true,
}: {
  building?: Partial<BuildingForm>;
  missing?: BuildingField[];
  invalid?: BuildingField[];
  derivedExitWidth?: number | null;
  canRemove?: boolean;
} = {}) {
  const onChange = jest.fn();
  const onRemove = jest.fn();
  render(
    <BuildingCard
      building={{ ...newBuilding(0, 'b1'), ...building }}
      index={0}
      onChange={onChange}
      onRemove={onRemove}
      canRemove={canRemove}
      missing={new Set(missing)}
      invalid={new Set(invalid)}
      derivedExitWidth={derivedExitWidth}
    />,
  );
  return { onChange, onRemove };
}

describe('BuildingCard', () => {
  it('uses number inputs for every numeric detail', () => {
    setup();
    for (const label of [/Office storeys/, /Top office floor/, /Floor area/, /Occupancy/, /Total exit width/]) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'number');
    }
    expect(screen.getByLabelText('Door group 1 count')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Door group 1 width (mm)')).toHaveAttribute('type', 'number');
  });

  it('shows the exit width the doors give when there is no override', () => {
    setup({ derivedExitWidth: 17 });
    expect(screen.getByText(/17 m from the doors, with the single largest door discounted/)).toBeInTheDocument();
  });

  it('says an override replaces the derived width', () => {
    setup({ building: { exitWidthOverride: '12.5' }, derivedExitWidth: 17 });
    expect(screen.getByText(/Overrides the 17 m the doors give/)).toBeInTheDocument();
  });

  it('adds and removes door groups', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ building: { doors: [{ count: '21', widthMm: '850' }] } });

    await user.click(screen.getByText('Add door group'));
    expect(onChange).toHaveBeenCalledWith({
      doors: [
        { count: '21', widthMm: '850' },
        { count: '', widthMm: '' },
      ],
    });

    await user.click(screen.getByLabelText('Remove door group 1'));
    expect(onChange).toHaveBeenCalledWith({ doors: [] });
  });

  it('reports edits to a door group as a patch', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ building: { doors: [{ count: '', widthMm: '850' }] } });
    await user.type(screen.getByLabelText('Door group 1 count'), '4');
    expect(onChange).toHaveBeenCalledWith({ doors: [{ count: '4', widthMm: '850' }] });
  });

  it('flags missing and invalid fields, including the door schedule', () => {
    setup({ missing: ['roomArea'], invalid: ['officeStoreys', 'doors'] });
    expect(screen.getByLabelText(/Floor area/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Office storeys/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Room height/)).not.toHaveAttribute('aria-invalid');
  });

  it('suggests one person per 30 m² of gross floor area', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ building: { roomArea: '43047' } });
    await user.click(screen.getByText(/Use 1,435/));
    expect(onChange).toHaveBeenCalledWith({ occupancy: '1435' });
  });

  it('hides Remove for the only building', () => {
    setup({ canRemove: false });
    // The door-group Remove buttons are named "Remove door group N", so this is the building's.
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('offers Remove when there are other buildings', async () => {
    const { onRemove } = setup({ canRemove: true });
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalled();
  });
});
