import {
  DEFAULT_FORM,
  defaultOccupancy,
  parseForm,
  toFormState,
} from '../../lib/smoke-layer-form';

describe('parseForm', () => {
  it('reports the blank required fields rather than guessing', () => {
    const parsed = parseForm(DEFAULT_FORM);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.missing).toEqual([
      'roomArea',
      'roomHeight',
      'maximumTravelDistance',
      'totalExitWidth',
      'occupancy',
    ]);
  });

  it('converts racking from a percentage to a fraction', () => {
    const parsed = parseForm({
      ...DEFAULT_FORM,
      roomArea: '43047',
      roomHeight: '15',
      rackingPerc: '33',
      maximumTravelDistance: '115',
      totalExitWidth: '17',
      occupancy: '1431',
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.inputs.rackingPerc).toBeCloseTo(0.33, 10);
    expect(parsed.inputs.roomArea).toBe(43047);
  });

  it('rejects a field that is not a number', () => {
    const parsed = parseForm({ ...DEFAULT_FORM, roomArea: 'wide' });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.missing).toContain('roomArea');
  });
});

describe('toFormState', () => {
  it('round-trips through parseForm', () => {
    const form = {
      ...DEFAULT_FORM,
      roomArea: '43047',
      roomHeight: '15',
      rackingPerc: '33',
      maximumTravelDistance: '115',
      totalExitWidth: '17',
      occupancy: '1431',
    };
    const parsed = parseForm(form);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const reparsed = parseForm(toFormState(parsed.inputs));
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.inputs).toEqual(parsed.inputs);
  });
});

describe('defaultOccupancy', () => {
  it('uses one person per 30 m² of gross floor area', () => {
    expect(defaultOccupancy(43047)).toBeCloseTo(1434.9, 1);
  });
});
