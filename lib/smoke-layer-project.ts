/**
 * The warehouse smoke layer document: one project, one set of shared
 * assumptions, and one or more buildings.
 *
 * Form values are held as strings so a part-typed field ("1", "1.", "") stays
 * exactly what the engineer typed; they are parsed into numbers only when the
 * model runs or the report is requested. Parsing is strict: a required field
 * that is blank or not a number is reported as missing, and an optional detail
 * that is filled in with something that is not the right kind of number is
 * reported as invalid rather than silently dropped.
 *
 * The wire shapes at the bottom (snake_case) match models/smoke_layer_models.py
 * on the backend: `ProjectDetails` is SmokeLayerProjectDetails, `BuildingDetails`
 * is SmokeLayerBuildingDetails, `ReportRequest` is SmokeLayerReportRequest.
 */

import { calculateSmokeLayer } from './smoke-layer-calc';
import {
  DEFAULT_TENABILITY_HEIGHT,
  type SmokeLayerInputs,
  type SmokeLayerResults,
} from './smoke-layer-types';

export const DOCUMENT_VERSION = 2 as const;

/** Occupancy density (m² per person) used to suggest an occupancy. */
export const DEFAULT_OCCUPANCY_DENSITY = 30;

// ---------------------------------------------------------------- form state

/** Assumptions that apply to every building in the assessment. */
export interface SharedForm {
  fgr: string;
  detectionTime: string;
  preMovementTime: string;
  walkingSpeed: string;
  flowRate: string;
  assessmentTime: string;
  tenabilityHeight: string;
  tstep: string;
}
export type SharedField = keyof SharedForm;

/** N exit doors of one clear width, e.g. 21 doors at 850 mm. */
export interface DoorGroupForm {
  count: string;
  widthMm: string;
}

export interface BuildingForm {
  id: string;
  name: string;
  roomArea: string;
  roomHeight: string;
  /** Entered as a percentage of the volume. */
  rackingPerc: string;
  /** The percentage comes from a proposed layout rather than the 50% default. */
  rackingKnown: boolean;
  maximumTravelDistance: string;
  occupancy: string;
  doors: DoorGroupForm[];
  /** Total exit width in metres; blank derives it from the doors. */
  exitWidthOverride: string;
  hasUndercroft: boolean;
  officeStoreys: string;
  officeHeightM: string;
}

/** Building fields that can be reported as missing or invalid. */
export type BuildingField =
  | 'roomArea'
  | 'roomHeight'
  | 'rackingPerc'
  | 'maximumTravelDistance'
  | 'occupancy'
  | 'doors'
  | 'exitWidthOverride'
  | 'officeStoreys'
  | 'officeHeightM';

export interface ProjectForm {
  projectName: string;
  engineerName: string;
  clientName: string;
  projectLocation: string;
  siteDescription: string;
  /** e.g. "storage and distribution purposes". Blank = fit-out unknown. */
  intendedPurpose: string;
  staircases: string;
  rackingSource: string;
  occupancyKnown: boolean;
  occupancySource: string;
  occupancyReference: string;
}
export type ProjectField = keyof ProjectForm;

export interface SmokeLayerDocument {
  version: typeof DOCUMENT_VERSION;
  project: ProjectForm;
  shared: SharedForm;
  buildings: BuildingForm[];
}

export const DEFAULT_SHARED: SharedForm = {
  fgr: '0.188',
  detectionTime: '60',
  preMovementTime: '180',
  walkingSpeed: '1.2',
  flowRate: '1.33',
  assessmentTime: '1200',
  tenabilityHeight: String(DEFAULT_TENABILITY_HEIGHT),
  tstep: '1',
};

export const DEFAULT_PROJECT: ProjectForm = {
  projectName: '',
  engineerName: '',
  clientName: '',
  projectLocation: '',
  siteDescription: '',
  intendedPurpose: '',
  staircases: '',
  rackingSource: '',
  occupancyKnown: false,
  occupancySource: '',
  occupancyReference: '',
};

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `b${Date.now().toString(36)}${idCounter}`;
}

export function newBuilding(index: number, id: string = newId()): BuildingForm {
  return {
    id,
    name: `Unit ${index + 1}`,
    roomArea: '',
    roomHeight: '',
    rackingPerc: '50',
    rackingKnown: false,
    maximumTravelDistance: '',
    occupancy: '',
    doors: [{ count: '', widthMm: '' }],
    exitWidthOverride: '',
    hasUndercroft: false,
    officeStoreys: '',
    officeHeightM: '',
  };
}

export function newDocument(): SmokeLayerDocument {
  return {
    version: DOCUMENT_VERSION,
    project: { ...DEFAULT_PROJECT },
    shared: { ...DEFAULT_SHARED },
    buildings: [newBuilding(0)],
  };
}

export const SHARED_FIELD_LABELS: Record<SharedField, string> = {
  fgr: 'Fire growth rate',
  detectionTime: 'Detection time',
  preMovementTime: 'Pre-movement time',
  walkingSpeed: 'Walking speed',
  flowRate: 'Flow rate',
  assessmentTime: 'Assessment time',
  tenabilityHeight: 'Tenability height',
  tstep: 'Timestep',
};

export const BUILDING_FIELD_LABELS: Record<BuildingField, string> = {
  roomArea: 'Floor area',
  roomHeight: 'Room height',
  rackingPerc: 'Racking',
  maximumTravelDistance: 'Maximum travel distance',
  occupancy: 'Occupancy',
  doors: 'Exit doors',
  exitWidthOverride: 'Total exit width',
  officeStoreys: 'Office storeys',
  officeHeightM: 'Top office floor height',
};

/** The default occupancy for a floor area, at one person per 30 m² gross. */
export function defaultOccupancy(roomArea: number): number {
  return roomArea / DEFAULT_OCCUPANCY_DENSITY;
}

// ---------------------------------------------------------------- wire types

export interface DoorGroup {
  count: number;
  width_mm: number;
}

export interface BuildingDetails {
  has_undercroft: boolean;
  office_storeys: number | null;
  office_height_m: number | null;
  racking_known: boolean;
  doors: DoorGroup[];
}

export interface ProjectDetails {
  client_name: string;
  project_location: string;
  site_description: string;
  intended_purpose: string;
  staircases: number | null;
  racking_source: string;
  occupancy_known: boolean;
  occupancy_source: string;
  occupancy_reference: string;
}

export interface ReportBuilding {
  name: string;
  inputs: SmokeLayerInputs;
  results: SmokeLayerResults;
  details: BuildingDetails;
}

export interface ReportRequest {
  project_name: string;
  engineer_name: string;
  project: ProjectDetails;
  buildings: ReportBuilding[];
}

// ---------------------------------------------------------------- parsing

/** A finite number from the field, or null when it is blank or not a number. */
function asNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function isBlank(raw: string): boolean {
  return raw.trim() === '';
}

function isNonNegativeInteger(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

/**
 * Total exit width in metres from the door schedule, discounting the single
 * largest door unless it is the only one (Kathryn's calculate_total_exit_width).
 */
export function exitWidthFromDoors(doors: DoorGroup[]): number {
  const groups = doors.filter((d) => d.count > 0);
  if (groups.length === 0) return 0;
  if (groups.length === 1 && groups[0].count === 1) return groups[0].width_mm / 1000;

  const largest = Math.max(...groups.map((d) => d.width_mm));
  let discounted = false;
  let totalMm = 0;
  for (const { count, width_mm } of groups) {
    let n = count;
    if (width_mm === largest && !discounted) {
      n -= 1;
      discounted = true;
    }
    totalMm += n * width_mm;
  }
  return totalMm / 1000;
}

export type SharedValues = Record<SharedField, number>;

export type ParsedShared = { ok: true; values: SharedValues } | { ok: false; missing: SharedField[] };

export function parseShared(shared: SharedForm): ParsedShared {
  const fields = Object.keys(SHARED_FIELD_LABELS) as SharedField[];
  const missing = fields.filter((f) => asNumber(shared[f]) === null);
  if (missing.length > 0) return { ok: false, missing };
  const values = {} as SharedValues;
  for (const f of fields) values[f] = asNumber(shared[f]) as number;
  return { ok: true, values };
}

type ParsedDoors = { ok: true; doors: DoorGroup[] } | { ok: false };

/** Wholly blank rows are ignored; anything else must be a whole count ≥ 1 and a width > 0. */
function parseDoors(rows: DoorGroupForm[]): ParsedDoors {
  const doors: DoorGroup[] = [];
  for (const row of rows) {
    if (isBlank(row.count) && isBlank(row.widthMm)) continue;
    const count = asNumber(row.count);
    const width = asNumber(row.widthMm);
    if (count === null || width === null) return { ok: false };
    if (!Number.isInteger(count) || count < 1 || width <= 0) return { ok: false };
    doors.push({ count, width_mm: width });
  }
  return { ok: true, doors };
}

export interface ParsedBuilding {
  ok: true;
  inputs: SmokeLayerInputs;
  details: BuildingDetails;
  /** The exit width the door schedule gives, for display beside an override. */
  derivedExitWidth: number | null;
}

export interface BuildingProblems {
  ok: false;
  /** Required fields that are blank or not a number. */
  missing: BuildingField[];
  /** Fields that hold something, but not the right kind of number. */
  invalid: BuildingField[];
}

export function parseBuilding(shared: SharedValues, b: BuildingForm): ParsedBuilding | BuildingProblems {
  const missing: BuildingField[] = [];
  const invalid: BuildingField[] = [];

  const required = ['roomArea', 'roomHeight', 'rackingPerc', 'maximumTravelDistance', 'occupancy'] as const;
  const numbers: Partial<Record<(typeof required)[number], number>> = {};
  for (const f of required) {
    const n = asNumber(b[f]);
    if (n === null) missing.push(f);
    else numbers[f] = n;
  }

  const doors = parseDoors(b.doors);
  if (!doors.ok) invalid.push('doors');
  const derivedExitWidth = doors.ok && doors.doors.length > 0 ? exitWidthFromDoors(doors.doors) : null;

  let totalExitWidth: number | null = null;
  if (!isBlank(b.exitWidthOverride)) {
    const n = asNumber(b.exitWidthOverride);
    if (n === null || n <= 0) invalid.push('exitWidthOverride');
    else totalExitWidth = n;
  } else if (derivedExitWidth !== null) {
    totalExitWidth = derivedExitWidth;
  } else if (doors.ok) {
    missing.push('doors');
  }

  let officeStoreys: number | null = null;
  if (!isBlank(b.officeStoreys)) {
    const n = asNumber(b.officeStoreys);
    if (n === null || !isNonNegativeInteger(n)) invalid.push('officeStoreys');
    else officeStoreys = n;
  }

  let officeHeightM: number | null = null;
  if (!isBlank(b.officeHeightM)) {
    const n = asNumber(b.officeHeightM);
    if (n === null || n < 0) invalid.push('officeHeightM');
    else officeHeightM = n;
  }

  if (missing.length > 0 || invalid.length > 0) return { ok: false, missing, invalid };

  return {
    ok: true,
    inputs: {
      roomArea: numbers.roomArea!,
      // Entered as a percentage, used as a fraction.
      rackingPerc: numbers.rackingPerc! / 100,
      roomHeight: numbers.roomHeight!,
      fgr: shared.fgr,
      detectionTime: shared.detectionTime,
      preMovementTime: shared.preMovementTime,
      maximumTravelDistance: numbers.maximumTravelDistance!,
      walkingSpeed: shared.walkingSpeed,
      totalExitWidth: totalExitWidth as number,
      flowRate: shared.flowRate,
      occupancy: numbers.occupancy!,
      assessmentTime: shared.assessmentTime,
      tenabilityHeight: shared.tenabilityHeight,
      tstep: shared.tstep,
    },
    details: {
      has_undercroft: b.hasUndercroft,
      office_storeys: officeStoreys,
      office_height_m: officeHeightM,
      racking_known: b.rackingKnown,
      doors: doors.ok ? doors.doors : [],
    },
    derivedExitWidth,
  };
}

export type ParsedProject = { ok: true; details: ProjectDetails } | { ok: false; invalid: ProjectField[] };

export function parseProject(p: ProjectForm): ParsedProject {
  let staircases: number | null = null;
  if (!isBlank(p.staircases)) {
    const n = asNumber(p.staircases);
    if (n === null || !isNonNegativeInteger(n)) return { ok: false, invalid: ['staircases'] };
    staircases = n;
  }
  return {
    ok: true,
    details: {
      client_name: p.clientName.trim(),
      project_location: p.projectLocation.trim(),
      site_description: p.siteDescription.trim(),
      intended_purpose: p.intendedPurpose.trim(),
      staircases,
      racking_source: p.rackingSource.trim(),
      occupancy_known: p.occupancyKnown,
      occupancy_source: p.occupancySource.trim(),
      occupancy_reference: p.occupancyReference.trim(),
    },
  };
}

// ---------------------------------------------------------------- evaluation

export type BuildingOutcome =
  | { state: 'incomplete'; missing: BuildingField[]; invalid: BuildingField[] }
  | { state: 'invalid'; message: string }
  | {
      state: 'ok';
      inputs: SmokeLayerInputs;
      details: BuildingDetails;
      results: SmokeLayerResults;
      derivedExitWidth: number | null;
    };

export interface BuildingEvaluation {
  id: string;
  name: string;
  outcome: BuildingOutcome;
}

export interface DocumentEvaluation {
  /** Blank or non-numeric shared assumptions; buildings cannot run until these are fixed. */
  sharedMissing: SharedField[];
  projectInvalid: ProjectField[];
  buildings: BuildingEvaluation[];
  /** Every building ran and the project details parse: a report can be requested. */
  ready: boolean;
}

/** Run the model for every building. The model is cheap, so this runs on every edit. */
export function evaluateDocument(doc: SmokeLayerDocument): DocumentEvaluation {
  const shared = parseShared(doc.shared);
  const project = parseProject(doc.project);
  const projectInvalid = project.ok ? [] : project.invalid;

  if (!shared.ok) {
    return {
      sharedMissing: shared.missing,
      projectInvalid,
      buildings: doc.buildings.map((b) => ({
        id: b.id,
        name: b.name,
        outcome: { state: 'incomplete', missing: [], invalid: [] },
      })),
      ready: false,
    };
  }

  const buildings = doc.buildings.map((b): BuildingEvaluation => {
    const parsed = parseBuilding(shared.values, b);
    if (!parsed.ok) {
      return { id: b.id, name: b.name, outcome: { state: 'incomplete', missing: parsed.missing, invalid: parsed.invalid } };
    }
    try {
      return {
        id: b.id,
        name: b.name,
        outcome: {
          state: 'ok',
          inputs: parsed.inputs,
          details: parsed.details,
          results: calculateSmokeLayer(parsed.inputs),
          derivedExitWidth: parsed.derivedExitWidth,
        },
      };
    } catch (e) {
      return {
        id: b.id,
        name: b.name,
        outcome: { state: 'invalid', message: e instanceof Error ? e.message : 'Calculation failed' },
      };
    }
  });

  const ready =
    project.ok && buildings.length > 0 && buildings.every((b) => b.outcome.state === 'ok');

  return { sharedMissing: [], projectInvalid, buildings, ready };
}

/** The report body, or null while anything is incomplete. */
export function buildReportRequest(doc: SmokeLayerDocument, evaluation: DocumentEvaluation): ReportRequest | null {
  const project = parseProject(doc.project);
  if (!project.ok || !evaluation.ready) return null;

  const buildings: ReportBuilding[] = [];
  for (const b of evaluation.buildings) {
    if (b.outcome.state !== 'ok') return null;
    buildings.push({
      name: b.name.trim() || 'Building',
      inputs: b.outcome.inputs,
      results: b.outcome.results,
      details: b.outcome.details,
    });
  }

  return {
    project_name: doc.project.projectName.trim(),
    engineer_name: doc.project.engineerName.trim(),
    project: project.details,
    buildings,
  };
}

// ---------------------------------------------------------------- saved runs

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
}

/**
 * A saved run back into form state. Accepts a current document, or the bare
 * SmokeLayerInputs the form saved before it held several buildings (with either
 * `tenabilityHeight` or the older `referenceHeight` name).
 */
export function loadDocument(raw: unknown): SmokeLayerDocument {
  if (!isRecord(raw)) throw new Error('This saved run is not in a shape the form understands.');

  if (raw.version === DOCUMENT_VERSION && isRecord(raw.project) && isRecord(raw.shared) && Array.isArray(raw.buildings)) {
    return raw as unknown as SmokeLayerDocument;
  }

  if (!('roomArea' in raw)) throw new Error('This saved run is not in a shape the form understands.');

  const legacy = raw as Partial<Record<keyof SmokeLayerInputs | 'referenceHeight', unknown>>;
  const building = newBuilding(0);
  building.roomArea = str(legacy.roomArea);
  building.roomHeight = str(legacy.roomHeight);
  building.rackingPerc =
    typeof legacy.rackingPerc === 'number' ? String(Math.round(legacy.rackingPerc * 100 * 1e6) / 1e6) : building.rackingPerc;
  building.maximumTravelDistance = str(legacy.maximumTravelDistance);
  building.occupancy = str(legacy.occupancy);
  building.exitWidthOverride = str(legacy.totalExitWidth);
  building.doors = [];

  const tenability = legacy.tenabilityHeight ?? legacy.referenceHeight;

  return {
    version: DOCUMENT_VERSION,
    project: { ...DEFAULT_PROJECT },
    shared: {
      fgr: str(legacy.fgr, DEFAULT_SHARED.fgr),
      detectionTime: str(legacy.detectionTime, DEFAULT_SHARED.detectionTime),
      preMovementTime: str(legacy.preMovementTime, DEFAULT_SHARED.preMovementTime),
      walkingSpeed: str(legacy.walkingSpeed, DEFAULT_SHARED.walkingSpeed),
      flowRate: str(legacy.flowRate, DEFAULT_SHARED.flowRate),
      assessmentTime: str(legacy.assessmentTime, DEFAULT_SHARED.assessmentTime),
      tenabilityHeight: str(tenability, DEFAULT_SHARED.tenabilityHeight),
      tstep: str(legacy.tstep, DEFAULT_SHARED.tstep),
    },
    buildings: [building],
  };
}
