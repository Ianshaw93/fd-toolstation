import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AssumptionsMatrix from '../../components/warehouse-smoke/AssumptionsMatrix';
import {
  DEFAULT_SHARED,
  newBuilding,
  withOverride,
  type BuildingField,
  type BuildingForm,
  type SharedForm,
} from '../../lib/smoke-layer-project';

function setup({
  shared = {},
  buildings = [newBuilding(0, 'b1'), { ...newBuilding(1, 'b2'), name: 'Unit 3' }],
  problems = {},
}: {
  shared?: Partial<SharedForm>;
  buildings?: BuildingForm[];
  problems?: Record<string, BuildingField[]>;
} = {}) {
  const onSharedChange = jest.fn();
  const onBuildingChange = jest.fn();
  render(
    <AssumptionsMatrix
      shared={{ ...DEFAULT_SHARED, ...shared }}
      buildings={buildings}
      onSharedChange={onSharedChange}
      onBuildingChange={onBuildingChange}
      problems={new Map(Object.entries(problems).map(([id, fields]) => [id, new Set(fields)]))}
    />,
  );
  return { onSharedChange, onBuildingChange };
}

const row = (label: RegExp) => screen.getByRole('row', { name: label });

describe('AssumptionsMatrix', () => {
  it('lays out one row per assumption and one column per building after the shared column', () => {
    setup();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Assumption', 'Shared', 'Unit 1', 'Unit 3']);
    expect(screen.getAllByRole('row', { name: /Detection time/ })).toHaveLength(1);
  });

  it('shows inherited cells carrying the shared value, marked as inherited', () => {
    setup();
    const cell = within(row(/Detection time/)).getByLabelText('Detection time for Unit 3');
    expect(cell).toHaveValue(60);
    expect(cell).toHaveAttribute('data-inherited', 'true');
    expect(within(row(/Detection time/)).queryByLabelText('Reset Detection time for Unit 3 to shared')).not.toBeInTheDocument();
  });

  it('turns an edit to an inherited cell into an override for that building only', async () => {
    const user = userEvent.setup();
    const { onBuildingChange, onSharedChange } = setup();
    // The cell shows the shared 60 through; a keystroke makes it this building's own 601.
    await user.type(screen.getByLabelText('Detection time for Unit 3'), '1');
    expect(onBuildingChange).toHaveBeenCalledWith('b2', { overrides: { detectionTime: '601' } });
    expect(onSharedChange).not.toHaveBeenCalled();
  });

  it('marks an overridden cell, tells the shared value, and offers a reset', async () => {
    const user = userEvent.setup();
    const b2 = withOverride({ ...newBuilding(1, 'b2'), name: 'Unit 3' }, 'detectionTime', '120');
    const { onBuildingChange } = setup({ buildings: [newBuilding(0, 'b1'), b2] });

    const cell = screen.getByLabelText('Detection time for Unit 3');
    expect(cell).toHaveValue(120);
    expect(cell).toHaveAttribute('data-inherited', 'false');
    expect(cell).toHaveAttribute('title', 'Shared value: 60 s');

    await user.click(screen.getByLabelText('Reset Detection time for Unit 3 to shared'));
    expect(onBuildingChange).toHaveBeenCalledWith('b2', { overrides: {} });
  });

  it('edits the shared column in place', async () => {
    const user = userEvent.setup();
    const { onSharedChange } = setup({ shared: { preMovementTime: '' } });
    await user.type(screen.getByLabelText('Shared Pre-movement time'), '9');
    expect(onSharedChange).toHaveBeenCalledWith('preMovementTime', '9');
  });

  it('offers the standard growth rates by name for each building', async () => {
    const user = userEvent.setup();
    const { onBuildingChange } = setup();
    const select = screen.getByLabelText('Fire growth rate for Unit 3');
    expect(select).toHaveValue('0.188');
    await user.selectOptions(select, '0.0469');
    expect(onBuildingChange).toHaveBeenCalledWith('b2', { overrides: { fgr: '0.0469' } });
  });

  it('can hide the rows where every building uses the shared value', async () => {
    const user = userEvent.setup();
    const b2 = withOverride({ ...newBuilding(1, 'b2'), name: 'Unit 3' }, 'detectionTime', '120');
    setup({ buildings: [newBuilding(0, 'b1'), b2] });

    await user.click(screen.getByLabelText('Show only differences'));
    expect(screen.getByRole('row', { name: /Detection time/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Pre-movement time/ })).not.toBeInTheDocument();
  });

  it('says so when nothing differs, instead of an empty table', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByLabelText('Show only differences'));
    expect(screen.getByText(/Every building uses the shared assumptions/)).toBeInTheDocument();
  });

  it('flags an override the model could not read', () => {
    const b2 = withOverride({ ...newBuilding(1, 'b2'), name: 'Unit 3' }, 'walkingSpeed', '');
    setup({ buildings: [newBuilding(0, 'b1'), b2], problems: { b2: ['walkingSpeed'] } });
    expect(screen.getByLabelText('Walking speed for Unit 3')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Walking speed for Unit 1')).not.toHaveAttribute('aria-invalid');
  });
});
