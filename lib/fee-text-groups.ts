import type {
  DesignStagesRiba1to4,
  DesignStagesRiba5,
  DesignStagesRiba6,
} from './fee-types';

export interface ProposalStageState {
  design_stages_1_4: DesignStagesRiba1to4;
  design_stages_5: DesignStagesRiba5;
  design_stages_6: DesignStagesRiba6;
}

// Groups that appear in every proposal regardless of selected services.
export const ALWAYS_GROUPS = ['Introductions', 'Terms of Business', 'Exclusions'];

/**
 * Which text-block groups (by group_name, as returned by the backend) are
 * relevant to the currently-included services. Used to show per-proposal
 * override fields only for sections that will actually appear in the document.
 */
export function relevantGroupsForState(state: ProposalStageState): Set<string> {
  const s14 = state.design_stages_1_4;
  const s5 = state.design_stages_5;
  const s6 = state.design_stages_6;
  const groups = new Set<string>(ALWAYS_GROUPS);

  if (s14.stage_1.included) groups.add('RIBA Stage 1');
  if (s14.stage_2.included) groups.add('RIBA Stage 2');
  if (s14.stage_3.included) groups.add('RIBA Stage 3');
  if (s14.stage_4.included) groups.add('RIBA Stage 4');
  if (s14.london_plan.included || s14.gateway.included) groups.add('London Plan & Gateway');
  if (s14.common_corridor_cfd.included || s14.open_plan_cfd.included || s14.warehouse_cfd.included) {
    groups.add('CFD Modelling');
  }
  if (s14.warehouse_structural.included) groups.add('Structural Fire Engineering');
  if (s14.peer_review.included) groups.add('Peer Review');

  if (Object.values(s5).some((svc) => svc.included)) groups.add('RIBA Stage 5 Services');
  if (Object.values(s6).some((svc) => svc.included)) groups.add('RIBA Stage 6 Services');

  return groups;
}
