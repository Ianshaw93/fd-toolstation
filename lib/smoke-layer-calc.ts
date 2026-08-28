/**
 * Single-zone smoke layer model for a base warehouse.
 *
 * Direct port of warehouse_smoke_layer.py (Drysdale, Introduction to Fire
 * Dynamics, 2011). The loop is reproduced step for step so results match the
 * Python to floating-point precision — see __tests__/warehouse-smoke.
 *
 * The layer depth is recomputed each timestep from the whole accumulated smoke
 * mass at the new layer temperature, rather than adding new smoke beneath a
 * static older layer. The old smoke therefore re-expands as the layer heats,
 * which drives the layer down faster. This is the conservative assumption and
 * is consistent with treating the layer as well mixed for temperature.
 */

import {
  TENABILITY_HEIGHT,
  ZONE_CONSTANTS,
  type SmokeLayerInputs,
  type SmokeLayerResults,
  type SmokeLayerStep,
} from './smoke-layer-types';

/** How long the run continues past ASET, to show the layer still descending. */
const RUN_ON_AFTER_ASET = 30;

const { E, g, rhoAmbient, cp, ambientT, convectivePortion, maxPlumeRiseK } = ZONE_CONSTANTS;

/**
 * Plume mass flow entering the layer (kg/s).
 * ṁ = E · ((g·ρ∞²)/(cp·T∞))^(1/3) · Qc^(1/3) · z^(5/3)
 */
function plumeMassFlow(convectiveHrrKw: number, clearHeight: number): number {
  return (
    E *
    Math.cbrt((g * rhoAmbient ** 2) / (cp * ambientT)) *
    Math.cbrt(convectiveHrrKw) *
    clearHeight ** (5 / 3)
  );
}

function validate(inputs: SmokeLayerInputs): void {
  const { roomArea, rackingPerc, roomHeight, totalExitWidth, flowRate, walkingSpeed, tstep, assessmentTime } = inputs;

  if (roomArea <= 0) throw new Error('Room area must be greater than zero.');
  if (roomHeight <= 0) throw new Error('Room height must be greater than zero.');
  if (rackingPerc < 0 || rackingPerc >= 1) {
    throw new Error('Racking percentage must be at least 0 and below 1 — racking cannot fill the whole floor plate.');
  }
  if (totalExitWidth <= 0) throw new Error('Total exit width must be greater than zero.');
  if (flowRate <= 0) throw new Error('Flow rate must be greater than zero.');
  if (walkingSpeed <= 0) throw new Error('Walking speed must be greater than zero.');
  if (tstep <= 0) throw new Error('Timestep must be greater than zero.');
  if (assessmentTime <= 0) throw new Error('Assessment time must be greater than zero.');
}

export function calculateSmokeLayer(inputs: SmokeLayerInputs): SmokeLayerResults {
  validate(inputs);

  const {
    roomArea,
    rackingPerc,
    roomHeight,
    fgr,
    detectionTime,
    preMovementTime,
    maximumTravelDistance,
    walkingSpeed,
    totalExitWidth,
    flowRate,
    occupancy,
    assessmentTime,
    referenceHeight,
    tstep,
  } = inputs;

  // --- Means of escape -----------------------------------------------------
  const totalPreEvac = detectionTime + preMovementTime + maximumTravelDistance / walkingSpeed;
  const peoplePerSecond = flowRate * totalExitWidth;
  const queueTime = Math.ceil(occupancy / peoplePerSecond);
  const rset = Math.ceil(totalPreEvac + queueTime);

  // --- Zone model ----------------------------------------------------------
  // Racking is treated as displacing volume uniformly over the full height, so
  // it reduces the plan area available to the smoke.
  const smokeArea = roomArea * (1 - rackingPerc);

  let aset = assessmentTime; // placeholder until 2 m is breached
  let z = roomHeight; // clear height below the layer
  let mUpper = 0; // accumulated mass of smoke in the layer
  let tempUpper = ambientT; // well-mixed layer temperature
  let asetTriggered = false;
  let referenceHeightBreached = false;
  let breachTime: number | null = null;
  let limit = assessmentTime;

  const steps: SmokeLayerStep[] = [];

  for (let t = tstep; t <= limit; t += tstep) {
    const qC = convectivePortion * fgr * t ** 2;
    const mSmoke = plumeMassFlow(qC, z);
    const tempSmoke = Math.min(qC / (mSmoke * cp) + ambientT, maxPlumeRiseK + ambientT);

    // New layer temperature is the mass-weighted mix of old and incoming smoke.
    tempUpper += ((tempSmoke - tempUpper) * mSmoke * tstep) / (mSmoke * tstep + mUpper);
    const rhoUpper = (rhoAmbient * ambientT) / tempUpper;

    mUpper += mSmoke * tstep;

    // The whole layer is taken to be at the new temperature, so it re-expands.
    const layerDepth = mUpper / (rhoUpper * smokeArea);
    const depthChange = layerDepth - (roomHeight - z);
    z = roomHeight - layerDepth;

    if (!referenceHeightBreached && z <= referenceHeight) {
      referenceHeightBreached = true;
      breachTime = t;
    }

    if (z <= TENABILITY_HEIGHT && !asetTriggered) {
      aset = t;
      asetTriggered = true;
      limit = aset + RUN_ON_AFTER_ASET;
    }

    steps.push({
      time: t,
      hrr: qC / (1000 * convectivePortion),
      convectiveHrr: qC / 1000,
      smokeLayerTemp: tempUpper - 273,
      addedSmokeTemp: tempSmoke - 273,
      clearHeight: z,
      depthChange,
      velocity: depthChange / tstep,
      escaped: Math.min(Math.max(peoplePerSecond * (t - totalPreEvac), 0), occupancy),
    });
  }

  return {
    steps,
    rset,
    aset,
    asetTriggered,
    marginOfSafety: aset - rset,
    referenceHeightBreached,
    breachTime,
    finalClearHeight: z,
    totalPreEvac,
    peoplePerSecond,
    queueTime,
  };
}
