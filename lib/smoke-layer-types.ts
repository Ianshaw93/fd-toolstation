/**
 * Types for the base warehouse smoke layer tool.
 *
 * Mirrors the inputs of the original Python script
 * (07 Technical Tools/1. Internal/Base Warehouse Smoke Depth/warehouse_smoke_layer.py).
 * See app/warehouse-smoke/REFERENCE.md.
 */

/** Fire growth rate coefficients (kW/s²) — BS 7974 / PD 7974-1 t-squared curves. */
export const FIRE_GROWTH_RATES = [
  { label: 'Slow', value: 0.0029 },
  { label: 'Medium', value: 0.0117 },
  { label: 'Fast', value: 0.0469 },
  { label: 'Ultra-fast', value: 0.188 },
] as const;

/** Physical constants for the zone model. Fixed at 20 °C / 293 K ambient. */
export const ZONE_CONSTANTS = {
  /** Entrainment coefficient in the Drysdale plume mass flow correlation. */
  E: 0.2,
  /** Acceleration due to gravity (m/s²). */
  g: 9.81,
  /** Density of air at 293 K (kg/m³). */
  rhoAmbient: 1.195,
  /** Specific heat capacity of air at 293 K (kJ/kg/K). */
  cp: 1.016,
  /** Ambient temperature (K). */
  ambientT: 293,
  /** Proportion of the heat release rate which is convective. */
  convectivePortion: 0.7,
  /** Plume temperature is capped at this many K above ambient. */
  maxPlumeRiseK: 900,
} as const;

/** Tenability limit — the clear height defining ASET. */
export const TENABILITY_HEIGHT = 2;

export interface SmokeLayerInputs {
  // Room and fire properties
  /** Floor area of the room (m²). */
  roomArea: number;
  /** Fraction of the compartment volume taken up by racking (0–1). */
  rackingPerc: number;
  /** Average height of the room (m). */
  roomHeight: number;
  /** Fire growth rate (kW/s²). */
  fgr: number;

  // Means of escape
  /** Time to detection (s). */
  detectionTime: number;
  /** Pre-movement time (s) — BS 7974-6 Table E.2. */
  preMovementTime: number;
  /** Maximum travel distance to an exit (m). */
  maximumTravelDistance: number;
  /** Walking speed (m/s). */
  walkingSpeed: number;
  /** Total width of available exits (m). */
  totalExitWidth: number;
  /** Flow rate through exits (people/s/m). */
  flowRate: number;
  /** Number of occupants. */
  occupancy: number;

  // Assessment
  /** Duration to run the simulation for (s). */
  assessmentTime: number;
  /** Optional additional height of interest, e.g. a beam soffit (m). */
  referenceHeight: number;
  /** Calculation timestep (s). */
  tstep: number;
}

/** One row of the timestep-by-timestep results. */
export interface SmokeLayerStep {
  /** Time (s). */
  time: number;
  /** Total heat release rate (MW). */
  hrr: number;
  /** Convective heat release rate (MW). */
  convectiveHrr: number;
  /** Well-mixed smoke layer temperature (°C). */
  smokeLayerTemp: number;
  /** Temperature of the smoke entering the layer this step (°C). */
  addedSmokeTemp: number;
  /** Height of clear air below the layer (m). */
  clearHeight: number;
  /** Change in layer depth over this timestep (m). */
  depthChange: number;
  /** Rate of descent of the layer (m/s). */
  velocity: number;
  /** Cumulative number of occupants escaped. */
  escaped: number;
}

export interface SmokeLayerResults {
  steps: SmokeLayerStep[];
  /** Required safe escape time (s). */
  rset: number;
  /** Available safe escape time (s) — when the layer reaches 2 m. */
  aset: number;
  /** Whether the 2 m tenability limit was actually breached. */
  asetTriggered: boolean;
  /** Margin of safety, ASET − RSET (s). Negative means tenability is exceeded. */
  marginOfSafety: number;
  /** Whether the optional reference height was breached. */
  referenceHeightBreached: boolean;
  /** Time the reference height was breached (s), or null. */
  breachTime: number | null;
  /** Clear height at the end of the run (m). */
  finalClearHeight: number;
  /** Time before occupants start leaving (s). */
  totalPreEvac: number;
  /** Occupant flow capacity (people/s). */
  peoplePerSecond: number;
  /** Time to clear the queue at the exits (s). */
  queueTime: number;
}

/** A named, saved set of inputs. */
export interface SavedRun {
  id: string;
  name: string;
  project_name: string | null;
  inputs: SmokeLayerInputs;
  created_at: string;
  updated_at: string;
}
