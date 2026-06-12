import { relevantGroupsForState, ALWAYS_GROUPS } from '../lib/fee-text-groups';
import type {
  ServiceConfig,
  DesignStagesRiba1to4,
  DesignStagesRiba5,
  DesignStagesRiba6,
} from '../lib/fee-types';

function off(): ServiceConfig {
  return {
    included: false, fee: 0, optional: false, limit_meetings: false,
    meeting_number: null, end_date_month: null, end_date_year: null,
    num_models: null, extended_travel_distance: false,
    hours_per_month: null, meetings_per_month: null,
  };
}
function on(): ServiceConfig {
  return { ...off(), included: true };
}

function mkState(overrides: {
  s14?: Partial<Record<string, ServiceConfig>>;
  s5?: Partial<Record<string, ServiceConfig>>;
  s6?: Partial<Record<string, ServiceConfig>>;
} = {}) {
  const base14 = {
    stage_1: off(), stage_2: off(), london_plan: off(), gateway: off(),
    stage_3: off(), stage_4: off(), common_corridor_cfd: off(), open_plan_cfd: off(),
    warehouse_structural: off(), warehouse_cfd: off(), peer_review: off(),
  };
  const base5 = {
    construction_advice: off(), site_visits: off(), site_risk_assessment: off(),
    cfsmp: off(), phased_occupation: off(), client_monitoring: off(),
  };
  const base6 = { regulation_38: off(), ews1_forms: off(), rro_risk_assessment: off() };
  return {
    design_stages_1_4: { ...base14, ...overrides.s14 } as DesignStagesRiba1to4,
    design_stages_5: { ...base5, ...overrides.s5 } as DesignStagesRiba5,
    design_stages_6: { ...base6, ...overrides.s6 } as DesignStagesRiba6,
  };
}

test('always-relevant groups appear even with no services', () => {
  const groups = relevantGroupsForState(mkState());
  for (const g of ALWAYS_GROUPS) expect(groups.has(g)).toBe(true);
  expect(groups.has('RIBA Stage 1')).toBe(false);
});

test('an included stage adds its group', () => {
  const groups = relevantGroupsForState(mkState({ s14: { stage_1: on() } }));
  expect(groups.has('RIBA Stage 1')).toBe(true);
});

test('any CFD service maps to the CFD Modelling group', () => {
  const groups = relevantGroupsForState(mkState({ s14: { open_plan_cfd: on() } }));
  expect(groups.has('CFD Modelling')).toBe(true);
});

test('peer review maps to the Peer Review group', () => {
  const groups = relevantGroupsForState(mkState({ s14: { peer_review: on() } }));
  expect(groups.has('Peer Review')).toBe(true);
});

test('a stage 5 service maps to RIBA Stage 5 Services', () => {
  const groups = relevantGroupsForState(mkState({ s5: { site_visits: on() } }));
  expect(groups.has('RIBA Stage 5 Services')).toBe(true);
});
