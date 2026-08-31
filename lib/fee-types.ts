export interface Engineer {
  full_name: string;
  email_prefix: string;
  phone_number: string;
  job_title: string;
}

export interface ServiceConfig {
  included: boolean;
  fee: number;
  optional: boolean;
  limit_meetings: boolean;
  meeting_number: number | null;
  end_date_month: string | null;
  end_date_year: string | null;
  num_models: number | null;
  extended_travel_distance: boolean;
  hours_per_month: number | null;
  meetings_per_month: number | null;
}

export interface ClientDetails {
  first_name: string;
  surname: string;
  address_lines: string[];
}

export type CountryCode = 'EW' | 'J' | 'OTHER';

export interface ProjectDetails {
  project_name: string;
  project_location: string;
  country: CountryCode;
  // Only used when country is 'OTHER'; England/Wales always attracts VAT and
  // Jersey never does.
  vat_applicable: boolean;
  // Legislation reference for an 'OTHER' country. Blank falls back to the
  // England/Wales reference.
  legislation: string;
}

export interface FeeOptions {
  engineer_name: string;
  pii_limit: number;
  include_hourly_rates: boolean;
}

export interface DesignStagesRiba1to4 {
  stage_1: ServiceConfig;
  stage_2: ServiceConfig;
  london_plan: ServiceConfig;
  gateway: ServiceConfig;
  stage_3: ServiceConfig;
  stage_4: ServiceConfig;
  common_corridor_cfd: ServiceConfig;
  open_plan_cfd: ServiceConfig;
  warehouse_structural: ServiceConfig;
  warehouse_cfd: ServiceConfig;
  peer_review: ServiceConfig;
}

export interface DesignStagesRiba5 {
  construction_advice: ServiceConfig;
  site_visits: ServiceConfig;
  site_risk_assessment: ServiceConfig;
  cfsmp: ServiceConfig;
  phased_occupation: ServiceConfig;
  client_monitoring: ServiceConfig;
}

export interface DesignStagesRiba6 {
  regulation_38: ServiceConfig;
  ews1_forms: ServiceConfig;
  rro_risk_assessment: ServiceConfig;
}

export interface FeeProposalRequest {
  client: ClientDetails;
  project: ProjectDetails;
  fee_options: FeeOptions;
  design_stages_1_4: DesignStagesRiba1to4;
  design_stages_5: DesignStagesRiba5;
  design_stages_6: DesignStagesRiba6;
  // Ephemeral per-proposal text overrides, keyed by text-block key.
  text_overrides?: Record<string, string>;
}

export interface TextBlock {
  key: string;
  label: string;
  kind: 'paragraph' | 'bullet_list' | 'template';
  group_name: string;
  sort_order: number;
  content: string;
  placeholders: string[];
  updated_by?: string | null;
}

export interface TextBlockHistoryEntry {
  id: number;
  content: string;
  edited_by: string;
  created_at?: string | null;
}

export type ServiceKey1to4 = keyof DesignStagesRiba1to4;
export type ServiceKey5 = keyof DesignStagesRiba5;
export type ServiceKey6 = keyof DesignStagesRiba6;
