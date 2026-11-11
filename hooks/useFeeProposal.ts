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
import { splitAddressLines } from '../lib/address-format';
import { NO_CONTACT_SUGGESTIONS, readContactSuggestions, type ContactSuggestions } from '../lib/client-contact-suggestions';
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
  /**
   * Who set the engineer: nobody yet, the signed-in account (engineer_account says which), or
   * the user (including a seeded form). Only an automatic engineer follows the account.
   */
  engineer_source: 'empty' | 'account' | 'user';
  engineer_account: string | null;
  /** The user changed an engineer that sign-in had chosen (for the "Edited by you" badge). */
  engineer_was_auto: boolean;
  /** Why the applied client address needs review, from the prefill's `review`. */
  directory_review: Array<'hasAddress_false' | 'home_slot_on_company_record'>;
  /** The linked Client company's people, offered as name tags. Never applied without a click. */
  contact_suggestions: ContactSuggestions;
  /** The tag the user last clicked, so a project switch can clear those names if still unchanged. */
  client_contact_pick: { contactId: number; firstName: string; lastName: string } | null;
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
  /** The signed-in account changed (null: signed out) and this fee-list engineer matches it, if any. */
  | { type: 'APPLY_ACCOUNT_ENGINEER'; accountKey: string | null; engineer: string | null }
  | { type: 'PICK_CLIENT_CONTACT'; contactId: number }
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
    engineer_source: 'empty',
    engineer_account: null,
    engineer_was_auto: false,
    directory_review: [],
    contact_suggestions: NO_CONTACT_SUGGESTIONS,
    client_contact_pick: null,
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

/**
 * The shared merge only lists what it applied this time. Fields the user kept still carry what was
 * applied before, so their history (and protection against refilling a cleared field) survives.
 */
function carryKept(previous: Partial<PrefillTarget>, merged: { applied: Partial<PrefillTarget>; kept: (keyof PrefillTarget)[] }) {
  const carried: Partial<PrefillTarget> = {};
  for (const key of merged.kept) if (key in previous) (carried as Record<string, unknown>)[key] = previous[key];
  return { ...carried, ...merged.applied };
}

function withSplitAddress(prefill: FeeProposalPrefill): FeeProposalPrefill {
  const address = prefill.fields.clientAddressLines;
  if (!Array.isArray(address.value)) return prefill;
  return {
    ...prefill,
    fields: { ...prefill.fields, clientAddressLines: { ...address, value: splitAddressLines(address.value) } },
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
    case 'HYDRATE': {
      const hydrated = { ...initialState(), ...action.state };
      if (hydrated.engineer_source === 'account') return hydrated;
      return {
        ...hydrated,
        engineer_source: hydrated.fee_options.engineer_name ? 'user' : 'empty',
        engineer_account: null,
        engineer_was_auto: false,
      };
    }

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
      const pick = state.client_contact_pick;
      if (pick && state.client.first_name === pick.firstName && state.client.surname === pick.lastName) {
        state = { ...state, client: { ...state.client, first_name: '', surname: '' } };
      }
      state = { ...state, client_contact_pick: null, contact_suggestions: NO_CONTACT_SUGGESTIONS };
      // No prefill yet: values filled for the previous project go back to their defaults.
      const reset = applyFeeProposalPrefill({
        current: prefillTarget(state),
        defaults: PREFILL_DEFAULTS,
        prefill: null,
        previouslyApplied: state.directory_applied,
        selectedRef: project.id,
      });
      const values = { ...reset.values };
      const applied = carryKept(state.directory_applied, reset);
      if (values.projectName === PREFILL_DEFAULTS.projectName && project.name) {
        values.projectName = project.name;
        applied.projectName = project.name;
      }
      const written = writePrefillTarget(state, values, applied);
      return {
        ...written,
        directory_review: 'clientAddressLines' in applied ? state.directory_review : [],
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
      // Split before merging so `applied` holds the lines as shown and edit protection compares them.
      const prefill = withSplitAddress(action.prefill);
      const merged = applyFeeProposalPrefill({
        current: prefillTarget(state),
        defaults: PREFILL_DEFAULTS,
        prefill,
        previouslyApplied: state.directory_applied,
        selectedRef: state.synergy_project_ref,
      });
      const lines = merged.applied.clientAddressLines;
      const overflow =
        lines && lines.length > PREFILL_DEFAULTS.clientAddressLines.length
          ? `The imported address has ${lines.length} lines, more than the usual six. All are kept below; check them before sending.`
          : null;
      const notice = [prefillNotice(prefill, merged.needsReview), overflow].filter(Boolean).join(' ');
      const addressReview = merged.needsReview.find((item) => item.field === 'clientAddressLines')?.review ?? [];
      return {
        ...writePrefillTarget(state, merged.values, carryKept(state.directory_applied, merged)),
        directory_review:
          merged.applied.clientAddressLines !== undefined
            ? addressReview
            : merged.kept.includes('clientAddressLines')
              ? state.directory_review
              : [],
        client_role_notice: notice || null,
        contact_suggestions: readContactSuggestions(prefill),
      };
    }

    case 'PICK_CLIENT_CONTACT': {
      const person = state.contact_suggestions.people.find((candidate) => candidate.id === action.contactId);
      if (!person) return state;
      return {
        ...state,
        client: { ...state.client, first_name: person.firstName, surname: person.lastName },
        client_contact_pick: { contactId: person.id, firstName: person.firstName, lastName: person.lastName },
      };
    }

    case 'APPLY_ACCOUNT_ENGINEER': {
      if (state.engineer_source === 'user') return state;
      if (state.engineer_source === 'empty' && state.fee_options.engineer_name) return { ...state, engineer_source: 'user' };
      if (state.engineer_source === 'account' && state.engineer_account === action.accountKey && state.fee_options.engineer_name === action.engineer) {
        return state;
      }
      const engineer = action.accountKey ? action.engineer : null;
      return {
        ...state,
        fee_options: { ...state.fee_options, engineer_name: engineer ?? '' },
        engineer_source: engineer ? 'account' : 'empty',
        engineer_account: engineer ? action.accountKey : null,
        engineer_was_auto: false,
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
        contact_suggestions: NO_CONTACT_SUGGESTIONS,
        project: {
          ...state.project,
          synergy_project_id: undefined,
          organisation_id: undefined,
          synergy_project_label: undefined,
        },
      };

    case 'SET_FEE_OPTIONS':
      return {
        ...state,
        fee_options: { ...state.fee_options, [action.field]: action.value },
        ...(action.field === 'engineer_name'
          ? {
              engineer_source: 'user' as const,
              engineer_account: null,
              engineer_was_auto: state.engineer_source === 'account' || state.engineer_was_auto,
            }
          : {}),
      };

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
