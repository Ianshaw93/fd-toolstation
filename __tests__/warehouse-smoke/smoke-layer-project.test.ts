import {
  DEFAULT_SHARED,
  buildReportRequest,
  describeSharedValue,
  effectiveShared,
  evaluateDocument,
  exitWidthFromDoors,
  loadDocument,
  newBuilding,
  newDocument,
  overriddenFields,
  parseBuilding,
  parseProject,
  parseShared,
  withOverride,
  withoutOverride,
  type BuildingForm,
  type SmokeLayerDocument,
} from '../../lib/smoke-layer-project';
import type { SmokeLayerInputs } from '../../lib/smoke-layer-types';

/** Kathryn's Building A, entered the way the form holds it. */
function unit1(overrides: Partial<BuildingForm> = {}): BuildingForm {
  return {
    ...newBuilding(0, 'b1'),
    name: 'Unit 1',
    roomArea: '43047',
    roomHeight: '15',
    rackingPerc: '33',
    rackingKnown: true,
    maximumTravelDistance: '115',
    occupancy: '1431',
    doors: [{ count: '21', widthMm: '850' }],
    ...overrides,
  };
}

function shared() {
  const parsed = parseShared(DEFAULT_SHARED);
  if (!parsed.ok) throw new Error('defaults should parse');
  return parsed.values;
}

describe('exitWidthFromDoors', () => {
  it('discounts the single largest door, as the Python does', () => {
    // 21 × 850 mm, one discounted: 20 × 0.85 m.
    expect(exitWidthFromDoors([{ count: 21, width_mm: 850 }])).toBeCloseTo(17, 10);
  });

  it('discounts one door from the widest group when widths differ', () => {
    // Groups: 2 × 1000 and 4 × 850. Discard one 1000: 1 × 1.0 + 4 × 0.85.
    expect(
      exitWidthFromDoors([
        { count: 4, width_mm: 850 },
        { count: 2, width_mm: 1000 },
      ]),
    ).toBeCloseTo(4.4, 10);
  });

  it('keeps a lone door rather than discounting it to nothing', () => {
    expect(exitWidthFromDoors([{ count: 1, width_mm: 900 }])).toBeCloseTo(0.9, 10);
  });

  it('is zero with no doors', () => {
    expect(exitWidthFromDoors([])).toBe(0);
  });
});

describe('parseShared', () => {
  it('parses the defaults, with the tenability height at 2 m', () => {
    const parsed = parseShared(DEFAULT_SHARED);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.values.tenabilityHeight).toBe(2);
    expect(parsed.values.fgr).toBe(0.188);
  });

  it('names a blank or non-numeric field', () => {
    const parsed = parseShared({ ...DEFAULT_SHARED, detectionTime: '', flowRate: 'quick' });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.missing).toEqual(['detectionTime', 'flowRate']);
  });
});

describe('parseBuilding', () => {
  it('derives the exit width from the door schedule and converts racking to a fraction', () => {
    const parsed = parseBuilding(shared(), unit1());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.inputs.totalExitWidth).toBeCloseTo(17, 10);
    expect(parsed.inputs.rackingPerc).toBeCloseTo(0.33, 10);
    expect(parsed.inputs.tenabilityHeight).toBe(2);
    expect(parsed.inputs.occupancy).toBe(1431);
    expect(parsed.details.doors).toEqual([{ count: 21, width_mm: 850 }]);
    expect(parsed.details.racking_known).toBe(true);
  });

  it('lets an override replace the derived exit width but keeps the doors for the report', () => {
    const parsed = parseBuilding(shared(), unit1({ exitWidthOverride: '12.5' }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.inputs.totalExitWidth).toBe(12.5);
    expect(parsed.derivedExitWidth).toBeCloseTo(17, 10);
    expect(parsed.details.doors).toEqual([{ count: 21, width_mm: 850 }]);
  });

  it('reports blank required fields rather than guessing', () => {
    const parsed = parseBuilding(shared(), { ...unit1(), roomArea: '', occupancy: '' });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.missing).toEqual(['roomArea', 'occupancy']);
    expect(parsed.invalid).toEqual([]);
  });

  it('treats no doors and no override as a missing exit width', () => {
    const parsed = parseBuilding(shared(), unit1({ doors: [] }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.missing).toEqual(['doors']);
  });

  it('ignores a wholly blank door row but rejects a half-filled one', () => {
    const blank = parseBuilding(
      shared(),
      unit1({ doors: [{ count: '21', widthMm: '850' }, { count: '', widthMm: '' }] }),
    );
    expect(blank.ok).toBe(true);

    const half = parseBuilding(
      shared(),
      unit1({ doors: [{ count: '21', widthMm: '850' }, { count: '2', widthMm: '' }] }),
    );
    expect(half.ok).toBe(false);
    if (half.ok) return;
    expect(half.invalid).toEqual(['doors']);
  });

  it('rejects a fractional door count and a zero width', () => {
    const parsed = parseBuilding(shared(), unit1({ doors: [{ count: '2.5', widthMm: '0' }] }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.invalid).toEqual(['doors']);
  });

  it('accepts blank office details as not known', () => {
    const parsed = parseBuilding(shared(), unit1());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.details.office_storeys).toBeNull();
    expect(parsed.details.office_height_m).toBeNull();
  });

  it('types the office details as numbers and rejects junk instead of dropping it', () => {
    const good = parseBuilding(shared(), unit1({ officeStoreys: '2', officeHeightM: '8.5' }));
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(good.details.office_storeys).toBe(2);
    expect(good.details.office_height_m).toBe(8.5);

    const bad = parseBuilding(shared(), unit1({ officeStoreys: '1.5', officeHeightM: 'tall' }));
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.invalid).toEqual(['officeStoreys', 'officeHeightM']);
  });
});

describe('per-building overrides of the shared assumptions', () => {
  it('starts every building on the shared values', () => {
    const b = newBuilding(0, 'b1');
    expect(b.overrides).toEqual({});
    expect(overriddenFields(b)).toEqual([]);
    expect(effectiveShared(DEFAULT_SHARED, b, 'detectionTime')).toBe('60');
  });

  it('uses the override for that building and leaves the shared values alone', () => {
    const b = withOverride(unit1(), 'detectionTime', '120');
    expect(overriddenFields(b)).toEqual(['detectionTime']);
    expect(effectiveShared(DEFAULT_SHARED, b, 'detectionTime')).toBe('120');
    expect(effectiveShared(DEFAULT_SHARED, b, 'preMovementTime')).toBe('180');

    const parsed = parseBuilding(shared(), b);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.inputs.detectionTime).toBe(120);
    expect(parsed.inputs.preMovementTime).toBe(180);
  });

  it('lists overrides in the shared field order, not the order they were made', () => {
    const b = withOverride(withOverride(unit1(), 'tstep', '0.5'), 'fgr', '0.047');
    expect(overriddenFields(b)).toEqual(['fgr', 'tstep']);
  });

  it('reverts to the shared value when the override is removed', () => {
    const b = withoutOverride(withOverride(unit1(), 'detectionTime', '120'), 'detectionTime');
    expect(overriddenFields(b)).toEqual([]);
    expect(effectiveShared(DEFAULT_SHARED, b, 'detectionTime')).toBe('60');
  });

  it('treats an override that matches the shared value as still an override', () => {
    // Webflow/Unity semantics: the engineer chose a value for this building, so a
    // later change to the shared value must not silently move it.
    const b = withOverride(unit1(), 'detectionTime', '60');
    expect(overriddenFields(b)).toEqual(['detectionTime']);
  });

  it('reports a blank or junk override as the missing field of that building', () => {
    const parsed = parseBuilding(shared(), withOverride(unit1(), 'walkingSpeed', 'fast'));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.missing).toEqual(['walkingSpeed']);
  });

  it('runs each building with its own value while the others inherit', () => {
    const doc: SmokeLayerDocument = {
      ...newDocument(),
      buildings: [unit1(), withOverride(unit1({ id: 'b2', name: 'Unit 3' }), 'detectionTime', '120')],
    };
    const evaluation = evaluateDocument(doc);
    const [a, b] = evaluation.buildings;
    expect(a.outcome.state).toBe('ok');
    expect(b.outcome.state).toBe('ok');
    if (a.outcome.state !== 'ok' || b.outcome.state !== 'ok') return;
    expect(a.outcome.inputs.detectionTime).toBe(60);
    expect(b.outcome.inputs.detectionTime).toBe(120);
    expect(b.outcome.results.rset).toBe(a.outcome.results.rset + 60);
  });

  it('describes values with their unit and growth rates by name', () => {
    expect(describeSharedValue('detectionTime', '120')).toBe('120 s');
    expect(describeSharedValue('fgr', '0.188')).toBe('Ultra-fast');
    expect(describeSharedValue('fgr', '0.05')).toBe('0.05 kW/s²');
    expect(describeSharedValue('tenabilityHeight', '')).toBe('blank');
  });
});

describe('parseProject', () => {
  it('trims text and types the staircase count', () => {
    const parsed = parseProject({
      ...newDocument().project,
      clientName: '  Shed Zone Ltd ',
      staircases: '2',
      occupancyKnown: true,
      occupancySource: 'the Fire Strategy Report',
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.details.client_name).toBe('Shed Zone Ltd');
    expect(parsed.details.staircases).toBe(2);
    expect(parsed.details.occupancy_known).toBe(true);
    expect(parsed.details.site_description).toBe('');
  });

  it('rejects a non-integer staircase count', () => {
    const parsed = parseProject({ ...newDocument().project, staircases: 'two' });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.invalid).toEqual(['staircases']);
  });
});

describe('evaluateDocument and buildReportRequest', () => {
  const doc: SmokeLayerDocument = {
    ...newDocument(),
    project: { ...newDocument().project, projectName: 'Shed Zone', engineerName: 'Kathryn Kleijn' },
    buildings: [unit1(), unit1({ id: 'b2', name: 'Unit 3', roomArea: '20000', maximumTravelDistance: '51.3' })],
  };

  it('runs the model for every building', () => {
    const evaluation = evaluateDocument(doc);
    expect(evaluation.buildings).toHaveLength(2);
    for (const b of evaluation.buildings) {
      expect(b.outcome.state).toBe('ok');
    }
    expect(evaluation.ready).toBe(true);
  });

  it('builds the project + buildings request the backend expects', () => {
    const request = buildReportRequest(doc, evaluateDocument(doc));
    expect(request).not.toBeNull();
    if (!request) return;
    expect(request.project_name).toBe('Shed Zone');
    expect(request.engineer_name).toBe('Kathryn Kleijn');
    expect(request.buildings.map((b) => b.name)).toEqual(['Unit 1', 'Unit 3']);
    expect(request.buildings[0].inputs.tenabilityHeight).toBe(2);
    expect(request.buildings[0].results.rset).toBe(400);
    expect(request.buildings[0].details.doors).toEqual([{ count: 21, width_mm: 850 }]);
    expect(request.project.occupancy_known).toBe(false);
  });

  it('is not ready, and yields no request, while any building is incomplete', () => {
    const partial = { ...doc, buildings: [unit1(), unit1({ id: 'b2', name: 'Unit 3', roomHeight: '' })] };
    const evaluation = evaluateDocument(partial);
    expect(evaluation.ready).toBe(false);
    expect(evaluation.buildings[1].outcome.state).toBe('incomplete');
    expect(buildReportRequest(partial, evaluation)).toBeNull();
  });

  it('reports a model error for one building without hiding the others', () => {
    const shaft = { ...doc, buildings: [unit1(), unit1({ id: 'b2', name: 'Shaft', roomHeight: '1.5' })] };
    const evaluation = evaluateDocument(shaft);
    expect(evaluation.buildings[0].outcome.state).toBe('ok');
    expect(evaluation.buildings[1].outcome.state).toBe('invalid');
  });
});

describe('loadDocument', () => {
  it('returns a current document unchanged', () => {
    const doc = newDocument();
    expect(loadDocument(doc)).toEqual(doc);
  });

  it('lifts a saved single-building input set into a one-building document', () => {
    const legacy: SmokeLayerInputs = {
      roomArea: 43047,
      rackingPerc: 0.33,
      roomHeight: 15,
      fgr: 0.188,
      detectionTime: 60,
      preMovementTime: 180,
      maximumTravelDistance: 115,
      walkingSpeed: 1.2,
      totalExitWidth: 17,
      flowRate: 1.33,
      occupancy: 1431,
      assessmentTime: 1200,
      tenabilityHeight: 2,
      tstep: 1,
    };
    const doc = loadDocument(legacy);
    expect(doc.buildings).toHaveLength(1);
    expect(doc.buildings[0].roomArea).toBe('43047');
    expect(doc.buildings[0].rackingPerc).toBe('33');
    expect(doc.buildings[0].exitWidthOverride).toBe('17');
    expect(doc.buildings[0].doors).toEqual([]);
    expect(doc.shared.tenabilityHeight).toBe('2');
    expect(doc.shared.detectionTime).toBe('60');
  });

  it('gives buildings saved before overrides existed an empty override set', () => {
    const doc = newDocument();
    const saved = JSON.parse(JSON.stringify(doc));
    delete saved.buildings[0].overrides;
    expect(loadDocument(saved).buildings[0].overrides).toEqual({});
  });

  it('reads the old referenceHeight name as the tenability height', () => {
    const doc = loadDocument({ roomArea: 100, roomHeight: 10, referenceHeight: 2.5 });
    expect(doc.shared.tenabilityHeight).toBe('2.5');
    expect(doc.shared.fgr).toBe(DEFAULT_SHARED.fgr);
  });

  it('gives up cleanly on something that is not a document', () => {
    expect(() => loadDocument('nonsense')).toThrow(/saved run/i);
  });
});
