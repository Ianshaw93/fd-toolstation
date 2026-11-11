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
import { prefillNotice } from '../lib/directory-prefill';
import {
  applyFeeProposalPrefill,
  type DirectoryProject,
  type FeeProposalPrefill,
  type PrefillTarget,
} from '../lib/vendor/fd-directory-client';

interface FeeProposalState {
  client: ClientDetails;
  project: ProjectDetails;
  fee_options: FeeOptions;
  design_stages_1_4: DesignStagesRiba1to4;
  design_stages_5: DesignStagesRiba5;
  design_stages_6: DesignStagesRiba6;
  /** Directory project id (`synergy:<org>:<project>`) of the linked project. */
  synergy_project_ref: string | null;
  /** What the shared prefill merge last wrote, so it can tell those values from the user's. */
  directory_applied: Partial<PrefillTarget>;
  client_role_notice: string | null;
}

export type FeeProposalSnapshot = FeeProposalState;

type Action =
  // Replace the whole form, e.g. from the state a Word document remembers.
  | { type: 'HYDRATE'; state: FeeProposalState }
  | { type: 'SET_CLIENT'; field: keyof ClientDetails; value: string | string[] }
  | { type: 'SET_PROJECT'; field: keyof ProjectDetails; value: string | boolean | number | undefined }
  | { type: 'LINK_DIRECTORY_PROJECT'; project: DirectoryProject }
  | { type: 'APPLY_DIRECTORY_PREFILL'; prefill: FeeProposalPrefill }
  | { type: 'SET_DIRECTORY_NOTICE'; ref: string; notice: string }
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
    synergy_project_ref: null,
    directory_applied: {},
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

const PREFILL_DEFAULTS: PrefillTarget = {
  projectName: '',
  projectCountry: 'EW',
  clientFirstName: '',
  clientSurname: '',
  clientCompanyName: '',
  clientAddressLines: ['', '', '', '', '', ''],
};

function prefillTarget(state: FeeProposalState): PrefillTarget {
  return {
    projectName: state.project.project_name,
    projectCountry: state.project.country,
    clientFirstName: state.client.first_name,
    clientSurname: state.client.surname,
    clientCompanyName: state.client.company_name ?? '',
    clientAddressLines: state.client.address_lines,
  };
}

function writePrefillTarget(state: FeeProposalState, values: PrefillTarget, applied: Partial<PrefillTarget>): FeeProposalState {
  const country = values.projectCountry as CountryCode;
  const countryChanged = country !== state.project.country;
  return {
    ...state,
    client: {
      ...state.client,
      company_name: values.clientCompanyName,
      first_name: values.clientFirstName,
      surname: values.clientSurname,
      address_lines: values.clientAddressLines,
    },
    project: {
      ...state.project,
      project_name: values.projectName,
      country,
      vat_applicable: countryChanged ? country === 'EW' : state.project.vat_applicable,
      legislation: countryChanged && country !== 'OTHER' ? '' : state.project.legislation,
    },
    directory_applied: applied,
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
          project: { ...state.project, country, vat_applicable, legislation },
        };
      }
      return { ...state, project: { ...state.project, [action.field]: action.value } };
    }

    case 'LINK_DIRECTORY_PROJECT': {
      const { project } = action;
      // No prefill yet: values filled for the previous project go back to their defaults.
      const reset = applyFeeProposalPrefill({
        current: prefillTarget(state),
        defaults: PREFILL_DEFAULTS,
        prefill: null,
        previouslyApplied: state.directory_applied,
        selectedRef: project.id,
      });
      const values = { ...reset.values };
      const applied = { ...reset.applied };
      if (values.projectName === PREFILL_DEFAULTS.projectName && project.name) {
        values.projectName = project.name;
        applied.projectName = project.name;
      }
      const written = writePrefillTarget(state, values, applied);
      return {
        ...written,
        synergy_project_ref: project.id,
        client_role_notice: null,
        project: {
          ...written.project,
          synergy_project_id: project.synergyProjectId,
          organisation_id: project.organisationId,
          synergy_project_label: project.label,
        },
      };
    }

    case 'APPLY_DIRECTORY_PREFILL': {
      if (!state.synergy_project_ref || action.prefill.project.id !== state.synergy_project_ref) return state;
      const merged = applyFeeProposalPrefill({
        current: prefillTarget(state),
        defaults: PREFILL_DEFAULTS,
        prefill: action.prefill,
        previouslyApplied: state.directory_applied,
        selectedRef: state.synergy_project_ref,
      });
      return {
        ...writePrefillTarget(state, merged.values, merged.applied),
        client_role_notice: prefillNotice(action.prefill, merged.needsReview),
      };
    }

    case 'SET_DIRECTORY_NOTICE':
      if (action.ref !== state.synergy_project_ref) return state;
      return { ...state, client_role_notice: action.notice };

    case 'UNLINK_SYNERGY_PROJECT':
      // Values and directory_applied stay, so choosing another project replaces only what was filled.
      return {
        ...state,
        synergy_project_ref: null,
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
