import { render, screen, fireEvent } from '@testing-library/react';
import BuildingOverviewSection from '../../components/efs/BuildingOverviewSection';
import type { BuildingOverview } from '../../lib/efs-types';

const defaultProps: BuildingOverview = {
  hasSuppression: false,
  suppressionStandard: 'BS EN 12845',
  fireAlarmCategory: 'L1',
  investigationPeriod: false,
  requiredFireResistance: '',
};

function renderSection(overrides: Partial<BuildingOverview> = {}) {
  const onChange = jest.fn();
  const data = { ...defaultProps, ...overrides };
  const result = render(<BuildingOverviewSection data={data} onChange={onChange} />);
  return { ...result, onChange };
}

describe('BuildingOverviewSection', () => {
  it('renders all five fields', () => {
    renderSection();
    expect(screen.getByLabelText('Has Suppression')).toBeInTheDocument();
    expect(screen.getByLabelText('Suppression Standard')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire Alarm & Detection Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Investigation Period')).toBeInTheDocument();
    expect(screen.getByLabelText('Required Fire Resistance (mins)')).toBeInTheDocument();
  });

  it('calls onChange when suppression toggled', () => {
    const { onChange } = renderSection();
    fireEvent.change(screen.getByLabelText('Has Suppression'), { target: { value: 'Yes' } });
    expect(onChange).toHaveBeenCalledWith('hasSuppression', true);
  });

  it('calls onChange for fire resistance input', () => {
    const { onChange } = renderSection();
    fireEvent.change(screen.getByLabelText('Required Fire Resistance (mins)'), { target: { value: '60' } });
    expect(onChange).toHaveBeenCalledWith('requiredFireResistance', '60');
  });

  it('renders fire alarm categories', () => {
    renderSection();
    const select = screen.getByLabelText('Fire Alarm & Detection Category') as HTMLSelectElement;
    const values = Array.from(select.options).map(o => o.value);
    expect(values).toEqual(['L1', 'L2', 'L3', 'L4', 'M']);
  });
});
