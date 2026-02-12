'use client';

import { useReducer, useMemo } from 'react';
import type {
  ClientDetails,
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

interface FeeProposalState {
  client: ClientDetails;
  project: ProjectDetails;
  fee_options: FeeOptions;
  design_stages_1_4: DesignStagesRiba1to4;
  design_stages_5: DesignStagesRiba5;
  design_stages_6: DesignStagesRiba6;
}

type Action =
  | { type: 'SET_CLIENT'; field: keyof ClientDetails; value: string | string[] }
  | { type: 'SET_PROJECT'; field: keyof ProjectDetails; value: string }
  | { type: 'SET_FEE_OPTIONS'; field: keyof FeeOptions; value: string | number | boolean }
  | { type: 'SET_SERVICE_1_4'; key: ServiceKey1to4; field: keyof ServiceConfig; value: boolean | number | string | null }
  | { type: 'SET_SERVICE_5'; key: ServiceKey5; field: keyof ServiceConfig; value: boolean | number | string | null }
  | { type: 'SET_SERVICE_6'; key: ServiceKey6; field: keyof ServiceConfig; value: boolean | number | string | null }
  | { type: 'TOGGLE_SERVICE_1_4'; key: ServiceKey1to4 }
  | { type: 'TOGGLE_SERVICE_5'; key: ServiceKey5 }
  | { type: 'TOGGLE_SERVICE_6'; key: ServiceKey6 };

const DESIGN_STAGE_KEYS: ServiceKey1to4[] = [
  'stage_1', 'stage_2', 'london_plan', 'gateway', 'stage_3', 'stage_4',
  'common_corridor_cfd', 'open_plan_cfd', 'warehouse_structural', 'warehouse_cfd',
];

function initialState(): FeeProposalState {
  return {
    client: { first_name: '', surname: '', address_lines: ['', '', '', '', '', ''] },
    project: { project_name: '', project_location: '', country: 'EW' },
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

function reducer(state: FeeProposalState, action: Action): FeeProposalState {
  switch (action.type) {
    case 'SET_CLIENT':
      return { ...state, client: { ...state.client, [action.field]: action.value } };

    case 'SET_PROJECT':
      return { ...state, project: { ...state.project, [action.field]: action.value } };

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
