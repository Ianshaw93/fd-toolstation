'use client';

import { useReducer, useMemo } from 'react';
import type {
  ClientDetails,
  CountryCode,
  ProjectDetails,
  FeeOptions,
  DesignStagesRiba1to4,
  DesignStagesRiba5,
  DesignStagesRiba6,
  ServiceConfig,
  FeeProposalRequest,
  ServiceKey1to4,
  ServiceKey5,
  ServiceKey6,
} from '../lib/fee-types';
import { defaultServiceConfig } from '../lib/fee-constants';
import {
  applyFeeProposalPrefill,
  applySynergyEnrichment,
  type FeeAutofillMemory,
  type FeeAutofillState,
  type FeeProposalPrefill,
  type SynergyFeeEnrichment,
} from '../lib/synergy-client-enrichment';

interface FeeProposalState {
  client: ClientDetails;
  project: ProjectDetails;
  fee_options: FeeOptions;
  design_stages_1_4: DesignStagesRiba1to4;
  design_stages_5: DesignStagesRiba5;
  design_stages_6: DesignStagesRiba6;
  synergy_link_generation: number;
  country_touched: boolean;
  synergy_autofill: FeeAutofillMemory | null;
  client_role_notice: string | null;
}

export type FeeProposalSnapshot = FeeProposalState;

type Action =
  // Replace the whole form, e.g. from the state a Word document remembers.
  | { type: 'HYDRATE'; state: FeeProposalState }
  | { type: 'SET_CLIENT'; field: keyof ClientDetails; value: string | string[] }
  | { type: 'SET_PROJECT'; field: keyof ProjectDetails; value: string | boolean | number | undefined }
  | {
      type: 'LINK_SYNERGY_PROJECT';
      synergy_project_id: number;
      organisation_id: number;
      label: string;
      generation: number;
      project_name?: string | null;
      project_location?: string | null;
    }
  | {
      type: 'APPLY_SYNERGY_ENRICHMENT';
      generation: number;
      enrichment: SynergyFeeEnrichment;
      engineer_names: string[];
    }
  | {
      type: 'APPLY_FEE_PREFILL';
      generation: number;
      prefill: FeeProposalPrefill;
      engineer_names: string[];
    }
  | { type: 'SET_SYNERGY_NOTICE'; generation: number; notice: string }
  | { type: 'UNLINK_SYNERGY_PROJECT' }
  | { type: 'SET_FEE_OPTIONS'; field: keyof FeeOptions; value: string | number | boolean }
  | { type: 'SET_SERVICE_1_4'; key: ServiceKey1to4; field: keyof ServiceConfig; value: boolean | number | string | null }
  | { type: 'SET_SERVICE_5'; key: ServiceKey5; field: keyof ServiceConfig; value: boolean | number | string | null }
  | { type: 'SET_SERVICE_6'; key: ServiceKey6; field: keyof ServiceConfig; value: boolean | number | string | null }
  | { type: 'TOGGLE_SERVICE_1_4'; key: ServiceKey1to4 }
  | { type: 'TOGGLE_SERVICE_5'; key: ServiceKey5 }
  | { type: 'TOGGLE_SERVICE_6'; key: ServiceKey6 };

const DESIGN_STAGE_KEYS: ServiceKey1to4[] = [
  'stage_1', 'stage_2', 'london_plan', 'gateway', 'stage_3', 'stage_4',
  'common_corridor_cfd', 'open_plan_cfd', 'warehouse_structural',
  'tma_structural', 'time_equivalency_structural', 'fem_structural', 'warehouse_cfd',
];

function initialState(): FeeProposalState {
  return {
    client: { first_name: '', surname: '', company_name: '', address_lines: ['', '', '', '', '', ''] },
    project: { project_name: '', project_location: '', country: 'EW', vat_applicable: true, legislation: '' },
    synergy_link_generation: 0,
    country_touched: false,
    synergy_autofill: null,
    client_role_notice: null,
    fee_options: { engineer_name: '', pii_limit: 100000, include_hourly_rates: false },
    design_stages_1_4: {
      stage_1: defaultServiceConfig(),
      stage_2: defaultServiceConfig(),
      london_plan: defaultServiceConfig(),
      gateway: defaultServiceConfig(),
      stage_3: defaultServiceConfig(),
      stage_4: defaultServiceConfig(),
      common_corridor_cfd: defaultServiceConfig(),
      open_plan_cfd: defaultServiceConfig(),
      tma_structural: defaultServiceConfig(),
      time_equivalency_structural: defaultServiceConfig(),
      fem_structural: defaultServiceConfig(),
      warehouse_structural: defaultServiceConfig(),
      warehouse_cfd: defaultServiceConfig(),
      peer_review: defaultServiceConfig(),
    },
    design_stages_5: {
      construction_advice: defaultServiceConfig(),
      site_visits: defaultServiceConfig(),
      site_risk_assessment: defaultServiceConfig(),
      cfsmp: defaultServiceConfig(),
      phased_occupation: defaultServiceConfig(),
      client_monitoring: defaultServiceConfig(),
    },
    design_stages_6: {
      regulation_38: defaultServiceConfig(),
      ews1_forms: defaultServiceConfig(),
      rro_risk_assessment: defaultServiceConfig(),
    },
  };
}

function autofillSlice(state: FeeProposalState): FeeAutofillState {
  return {
    company_name: state.client.company_name ?? '',
    first_name: state.client.first_name,
    surname: state.client.surname,
    address_lines: state.client.address_lines,
    project_name: state.project.project_name,
    project_location: state.project.project_location,
    country: state.project.country,
    country_touched: state.country_touched,
    engineer_name: state.fee_options.engineer_name,
    pii_limit: state.fee_options.pii_limit,
    include_hourly_rates: state.fee_options.include_hourly_rates,
    autofill: state.synergy_autofill,
    notice: state.client_role_notice,
  };
}

function writeAutofill(
  state: FeeProposalState,
  applied: FeeAutofillState & { notice: string | null },
): FeeProposalState {
  const countryChanged = applied.country !== state.project.country;
  return {
    ...state,
    client: {
      ...state.client,
      company_name: applied.company_name,
      first_name: applied.first_name,
      surname: applied.surname,
      address_lines: applied.address_lines,
    },
    project: {
      ...state.project,
      project_name: applied.project_name,
      project_location: applied.project_location,
      country: applied.country,
      vat_applicable: countryChanged ? applied.country === 'EW' : state.project.vat_applicable,
      legislation: countryChanged && applied.country !== 'OTHER' ? '' : state.project.legislation,
    },
    fee_options: {
      ...state.fee_options,
      engineer_name: applied.engineer_name,
      pii_limit: applied.pii_limit,
      include_hourly_rates: applied.include_hourly_rates,
    },
    synergy_autofill: applied.autofill,
    client_role_notice: applied.notice,
  };
}

function reducer(state: FeeProposalState, action: Action): FeeProposalState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...initialState(), ...action.state };

    case 'SET_CLIENT':
      return { ...state, client: { ...state.client, [action.field]: action.value } };

    case 'SET_PROJECT': {
      if (action.field === 'country') {
        const country = action.value as CountryCode;
        // VAT and legislation are fixed for England/Wales and Jersey; for
        // 'Other' the user states them, starting from no VAT.
        const vat_applicable = country === 'EW';
        const legislation = country === 'OTHER' ? state.project.legislation : '';
        return {
          ...state,
          country_touched: true,
          project: { ...state.project, country, vat_applicable, legislation },
        };
      }
      return { ...state, project: { ...state.project, [action.field]: action.value } };
    }

    case 'LINK_SYNERGY_PROJECT': {
      const absent = { value: null, status: 'absent' as const, source: null };
      const applied = applyFeeProposalPrefill(autofillSlice(state), {
        company_name: absent,
        first_name: absent,
        surname: absent,
        address_lines: absent,
        project_name: action.project_name?.trim()
          ? { value: action.project_name.trim(), status: 'present', source: 'project_name' }
          : absent,
        project_location: absent,
        country: absent,
        engineer_name: absent,
        pii_limit: absent,
        include_hourly_rates: absent,
      }, []);
      const written = writeAutofill(state, applied);
      return {
        ...written,
        synergy_link_generation: action.generation,
        project: {
          ...written.project,
          synergy_project_id: action.synergy_project_id,
          organisation_id: action.organisation_id,
          synergy_project_label: action.label,
        },
      };
    }

    case 'APPLY_FEE_PREFILL': {
      if (action.generation !== state.synergy_link_generation) return state;
      const applied = applyFeeProposalPrefill(
        autofillSlice(state),
        action.prefill,
        action.engineer_names,
        { generation: action.generation, currentGeneration: state.synergy_link_generation },
      );
      return writeAutofill(state, applied);
    }

    case 'APPLY_SYNERGY_ENRICHMENT': {
      if (action.generation !== state.synergy_link_generation) return state;
      const applied = applySynergyEnrichment(
        autofillSlice(state),
        action.enrichment,
        action.engineer_names,
        { generation: action.generation, currentGeneration: state.synergy_link_generation },
      );
      return writeAutofill(state, applied);
    }

    case 'SET_SYNERGY_NOTICE':
      if (action.generation !== state.synergy_link_generation) return state;
      return { ...state, client_role_notice: action.notice };

    case 'UNLINK_SYNERGY_PROJECT':
      return {
        ...state,
        synergy_link_generation: 0,
        synergy_autofill: null,
        client_role_notice: null,
        project: {
          ...state.project,
          synergy_project_id: undefined,
          organisation_id: undefined,
          synergy_project_label: undefined,
        },
      };

    case 'SET_FEE_OPTIONS':
      return { ...state, fee_options: { ...state.fee_options, [action.field]: action.value } };

    case 'SET_SERVICE_1_4':
      return {
        ...state,
        design_stages_1_4: {
          ...state.design_stages_1_4,
          [action.key]: { ...state.design_stages_1_4[action.key], [action.field]: action.value },
        },
      };

    case 'SET_SERVICE_5':
      return {
        ...state,
        design_stages_5: {
          ...state.design_stages_5,
          [action.key]: { ...state.design_stages_5[action.key], [action.field]: action.value },
        },
      };

    case 'SET_SERVICE_6':
      return {
        ...state,
        design_stages_6: {
          ...state.design_stages_6,
          [action.key]: { ...state.design_stages_6[action.key], [action.field]: action.value },
        },
      };

    case 'TOGGLE_SERVICE_1_4': {
      const current = state.design_stages_1_4[action.key];
      const newIncluded = !current.included;

      // Peer review mutual exclusion
      if (action.key === 'peer_review' && newIncluded) {
        const cleared = { ...state.design_stages_1_4 };
        for (const k of DESIGN_STAGE_KEYS) {
          cleared[k] = { ...cleared[k], included: false, fee: 0, optional: false, limit_meetings: false, meeting_number: null };
        }
        cleared.peer_review = { ...cleared.peer_review, included: true };
        return { ...state, design_stages_1_4: cleared };
      }

      // If enabling a design stage, disable peer review
      if (action.key !== 'peer_review' && newIncluded && state.design_stages_1_4.peer_review.included) {
        return {
          ...state,
          design_stages_1_4: {
            ...state.design_stages_1_4,
            peer_review: { ...state.design_stages_1_4.peer_review, included: false, fee: 0, optional: false, limit_meetings: false, meeting_number: null },
            [action.key]: { ...current, included: true },
          },
        };
      }

      if (!newIncluded) {
        return {
          ...state,
          design_stages_1_4: {
            ...state.design_stages_1_4,
            [action.key]: { ...defaultServiceConfig() },
          },
        };
      }

      return {
        ...state,
        design_stages_1_4: {
          ...state.design_stages_1_4,
          [action.key]: { ...current, included: newIncluded },
        },
      };
    }

    case 'TOGGLE_SERVICE_5': {
      const current = state.design_stages_5[action.key];
      if (current.included) {
        return {
          ...state,
          design_stages_5: {
            ...state.design_stages_5,
            [action.key]: { ...defaultServiceConfig() },
          },
        };
      }
      return {
        ...state,
        design_stages_5: {
          ...state.design_stages_5,
          [action.key]: { ...current, included: true },
        },
      };
    }

    case 'TOGGLE_SERVICE_6': {
      const current = state.design_stages_6[action.key];
      if (current.included) {
        return {
          ...state,
          design_stages_6: {
            ...state.design_stages_6,
            [action.key]: { ...defaultServiceConfig() },
          },
        };
      }
      return {
        ...state,
        design_stages_6: {
          ...state.design_stages_6,
          [action.key]: { ...current, included: true },
        },
      };
    }

    default:
      return state;
  }
}

export function useFeeProposal() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const totalFee = useMemo(() => {
    let total = 0;
    const s14 = state.design_stages_1_4;
    for (const key of Object.keys(s14) as ServiceKey1to4[]) {
      if (s14[key].included) total += s14[key].fee || 0;
    }
    const s5 = state.design_stages_5;
    for (const key of Object.keys(s5) as ServiceKey5[]) {
      if (s5[key].included) total += s5[key].fee || 0;
    }
    const s6 = state.design_stages_6;
    for (const key of Object.keys(s6) as ServiceKey6[]) {
      if (s6[key].included) total += s6[key].fee || 0;
    }
    return total;
  }, [state.design_stages_1_4, state.design_stages_5, state.design_stages_6]);

  const buildRequest = (): FeeProposalRequest => ({
    client: {
      ...state.client,
      company_name: state.client.company_name ?? '',
      address_lines: state.client.address_lines.filter((l) => l.trim() !== ''),
    },
    project: state.project,
    fee_options: state.fee_options,
    design_stages_1_4: state.design_stages_1_4,
    design_stages_5: state.design_stages_5,
    design_stages_6: state.design_stages_6,
  });

  return { state, dispatch, totalFee, buildRequest };
}
