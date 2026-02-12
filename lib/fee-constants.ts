export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const YEARS = Array.from({ length: 17 }, (_, i) => String(2024 + i));

export const COUNTRIES: { value: 'EW' | 'J'; label: string }[] = [
  { value: 'EW', label: 'England or Wales' },
  { value: 'J', label: 'Jersey' },
];

export const SERVICE_LABELS_1_4: Record<string, string> = {
  stage_1: 'RIBA Stage 1',
  stage_2: 'RIBA Stage 2',
  london_plan: 'London Plan',
  gateway: 'Gateway 1',
  stage_3: 'RIBA Stage 3',
  stage_4: 'RIBA Stage 4',
  common_corridor_cfd: 'Common Corridor CFD',
  open_plan_cfd: 'Open Plan CFD',
  warehouse_structural: 'Warehouse Structural Fire Engineering',
  warehouse_cfd: 'Warehouse CFD',
  peer_review: 'Peer Review',
};

export const SERVICE_LABELS_5: Record<string, string> = {
  construction_advice: 'Construction Advice',
  site_visits: 'Site Visits',
  site_risk_assessment: 'Site Risk Assessment',
  cfsmp: 'CFSMP',
  phased_occupation: 'Phased Occupation',
  client_monitoring: 'Client Monitoring',
};

export const SERVICE_LABELS_6: Record<string, string> = {
  regulation_38: 'Regulation 38',
  ews1_forms: 'EWS1 Forms',
  rro_risk_assessment: 'RRO Risk Assessment',
};

// Services that have num_models field
export const SERVICES_WITH_MODELS = new Set([
  'common_corridor_cfd',
  'open_plan_cfd',
  'warehouse_structural',
  'warehouse_cfd',
  'peer_review',
]);

// Services that have extended travel distance
export const SERVICES_WITH_EXTENDED_TRAVEL = new Set(['common_corridor_cfd']);

// Services that have hours_per_month and meetings_per_month instead of limit_meetings
export const SERVICES_WITH_HOURS = new Set(['construction_advice']);

export function defaultServiceConfig(): import('./fee-types').ServiceConfig {
  return {
    included: false,
    fee: 0,
    optional: false,
    limit_meetings: false,
    meeting_number: null,
    end_date_month: null,
    end_date_year: null,
    num_models: null,
    extended_travel_distance: false,
    hours_per_month: null,
    meetings_per_month: null,
  };
}
