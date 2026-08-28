/**
 * Form state for the warehouse smoke layer tool.
 *
 * Inputs are held as strings so a part-typed field ("1", "1.", "") stays
 * exactly what the engineer typed, and are parsed into numbers only when the
 * model runs. Defaults follow the original Python script's documented values.
 */

import type { SmokeLayerInputs } from './smoke-layer-types';

export type SmokeLayerFormState = Record<keyof SmokeLayerInputs, string>;

/** Occupancy density (m² per person) used to seed the occupancy field. */
export const DEFAULT_OCCUPANCY_DENSITY = 30;

export const DEFAULT_FORM: SmokeLayerFormState = {
  roomArea: '',
  rackingPerc: '50',
  roomHeight: '',
  fgr: '0.188',

  detectionTime: '60',
  preMovementTime: '180',
  maximumTravelDistance: '',
  walkingSpeed: '1.2',
  totalExitWidth: '',
  flowRate: '1.33',
  occupancy: '',

  assessmentTime: '1200',
  referenceHeight: '2',
  tstep: '1',
};

/** Fields that must be filled in before the model can run. */
const REQUIRED: (keyof SmokeLayerInputs)[] = [
  'roomArea',
  'roomHeight',
  'fgr',
  'rackingPerc',
  'detectionTime',
  'preMovementTime',
  'maximumTravelDistance',
  'walkingSpeed',
  'totalExitWidth',
  'flowRate',
  'occupancy',
  'assessmentTime',
  'referenceHeight',
  'tstep',
];

export interface ParseSuccess {
  ok: true;
  inputs: SmokeLayerInputs;
}

export interface ParseFailure {
  ok: false;
  /** Fields that are blank or not a number, in form order. */
  missing: (keyof SmokeLayerInputs)[];
}

/**
 * The default occupancy for a floor area, at one person per 30 m².
 * Uses the gross floor area, before any reduction for racking.
 */
export function defaultOccupancy(roomArea: number): number {
  return roomArea / DEFAULT_OCCUPANCY_DENSITY;
}

export function parseForm(form: SmokeLayerFormState): ParseSuccess | ParseFailure {
  const missing = REQUIRED.filter((field) => {
    const raw = form[field].trim();
    return raw === '' || !Number.isFinite(Number(raw));
  });

  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    inputs: {
      roomArea: Number(form.roomArea),
      // Entered as a percentage, used as a fraction.
      rackingPerc: Number(form.rackingPerc) / 100,
      roomHeight: Number(form.roomHeight),
      fgr: Number(form.fgr),

      detectionTime: Number(form.detectionTime),
      preMovementTime: Number(form.preMovementTime),
      maximumTravelDistance: Number(form.maximumTravelDistance),
      walkingSpeed: Number(form.walkingSpeed),
      totalExitWidth: Number(form.totalExitWidth),
      flowRate: Number(form.flowRate),
      occupancy: Number(form.occupancy),

      assessmentTime: Number(form.assessmentTime),
      referenceHeight: Number(form.referenceHeight),
      tstep: Number(form.tstep),
    },
  };
}

/** Turn a saved set of inputs back into form state. */
export function toFormState(inputs: SmokeLayerInputs): SmokeLayerFormState {
  return {
    roomArea: String(inputs.roomArea),
    rackingPerc: String(inputs.rackingPerc * 100),
    roomHeight: String(inputs.roomHeight),
    fgr: String(inputs.fgr),

    detectionTime: String(inputs.detectionTime),
    preMovementTime: String(inputs.preMovementTime),
    maximumTravelDistance: String(inputs.maximumTravelDistance),
    walkingSpeed: String(inputs.walkingSpeed),
    totalExitWidth: String(inputs.totalExitWidth),
    flowRate: String(inputs.flowRate),
    occupancy: String(inputs.occupancy),

    assessmentTime: String(inputs.assessmentTime),
    referenceHeight: String(inputs.referenceHeight),
    tstep: String(inputs.tstep),
  };
}

export const FIELD_LABELS: Record<keyof SmokeLayerInputs, string> = {
  roomArea: 'Floor area',
  rackingPerc: 'Racking',
  roomHeight: 'Room height',
  fgr: 'Fire growth rate',
  detectionTime: 'Detection time',
  preMovementTime: 'Pre-movement time',
  maximumTravelDistance: 'Maximum travel distance',
  walkingSpeed: 'Walking speed',
  totalExitWidth: 'Total exit width',
  flowRate: 'Flow rate',
  occupancy: 'Occupancy',
  assessmentTime: 'Assessment time',
  referenceHeight: 'Reference height',
  tstep: 'Timestep',
};
