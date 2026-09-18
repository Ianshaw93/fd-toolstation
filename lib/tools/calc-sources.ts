export interface CalcSource {
  id: string;
  label: string;
  /** Short line used after “Based on …”. */
  blurb: string;
  /** Query tokens (post-normalize) that make this source relevant. */
  match: string[];
}

/**
 * Calc / standard citations already mined from toolstation + upload-canvas +
 * REFERENCE.md. Do not add guessed names (no Alpert — not in the code).
 */
export const CALC_SOURCES: Record<string, CalcSource> = {
  'br-187': {
    id: 'br-187',
    label: 'BR 187',
    blurb: 'BR 187 radiation / view-factor boundary distance calcs',
    match: ['br', 'br 187', 'br187', 'br-187', '187'],
  },
  'bre-135': {
    id: 'bre-135',
    label: 'BRE 135',
    blurb: 'BRE 135 external fire spread assessment',
    match: ['bre', 'bre 135', 'bre135', 'bre-135', '135'],
  },
  'bs-pd-7974': {
    id: 'bs-pd-7974',
    label: 'BS/PD 7974',
    blurb: 'BS/PD 7974 (t² growth, pre-movement / flow tables)',
    match: ['7974', 'bs 7974', 'pd 7974', '7974-1', '7974-6', '79741', '79746', 'pd7974', 'bs7974'],
  },
  'cibse-guide-e': {
    id: 'cibse-guide-e',
    label: 'CIBSE Guide E',
    blurb: 'CIBSE Guide E tenability / walking speed',
    match: ['cibse', 'cibse guide e', 'guide e'],
  },
  'drysdale': {
    id: 'drysdale',
    label: 'Drysdale',
    blurb: 'Drysdale plume mass-flow correlation',
    match: ['drysdale'],
  },
  'ec1-annex-a': {
    id: 'ec1-annex-a',
    label: 'EC1 Annex A',
    blurb: 'EC1 Annex A (EN 1991) t_lim / parametric fire',
    match: ['ec1', 'en 1991', 'en1991', 'eurocode', 'eurocode 1', 'ec1 annex a'],
  },
  'pd-6688': {
    id: 'pd-6688',
    label: 'PD 6688',
    blurb: 'PD 6688 b-value limits',
    match: ['pd 6688', '6688', 'pd6688'],
  },
  'iso-834': {
    id: 'iso-834',
    label: 'ISO 834',
    blurb: 'ISO 834 time-equivalence fire curve',
    match: ['iso 834', 'iso834', 'iso fire'],
  },
  'quintiere': {
    id: 'quintiere',
    label: 'Quintiere',
    blurb: 'Quintiere Fundamentals of Fire Phenomena Table 7.6 (b-values)',
    match: ['quintiere'],
  },
  'nist-fds': {
    id: 'nist-fds',
    label: 'NIST FDS User Guide',
    blurb: 'NIST FDS User Guide / PyroSim mesh rules',
    match: ['nist fds', 'fds user guide', 'pyrosim', 'fds-smv'],
  },
};

export function resolveCalcSources(ids: string[] | undefined): CalcSource[] {
  if (!ids) return [];
  return ids.map((id) => CALC_SOURCES[id]).filter(Boolean);
}
