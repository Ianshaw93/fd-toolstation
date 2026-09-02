/**
 * Report wording inputs for the warehouse smoke layer Word report.
 *
 * None of these affect the calculation. Blank means "not known": the backend then
 * uses the conservative wording and inserts a highlighted prompt for the engineer
 * where something has to be written by hand. Field names are the wire format
 * (snake_case, matching models/smoke_layer_models.py SmokeLayerReportDetails).
 */

export interface ReportDetailsForm {
  client_name: string;
  project_location: string;
  building_name: string;
  site_description: string;
  /** e.g. "storage and distribution purposes". Blank = fit-out unknown. */
  intended_purpose: string;
  racking_known: boolean;
  racking_source: string;
  occupancy_known: boolean;
  occupancy_source: string;
  occupancy_reference: string;
  has_undercroft: boolean;
  office_storeys: string;
  office_height: string;
  staircases: string;
  number_of_doors: string;
  door_width_mm: string;
}

export interface ReportDetails {
  client_name: string;
  project_location: string;
  building_name: string;
  site_description: string;
  intended_purpose: string;
  racking_known: boolean;
  racking_source: string;
  occupancy_known: boolean;
  occupancy_source: string;
  occupancy_reference: string;
  has_undercroft: boolean;
  office_storeys: number | null;
  office_height: string;
  staircases: number | null;
  number_of_doors: number | null;
  door_width_mm: number | null;
}

export const DEFAULT_REPORT_DETAILS: ReportDetailsForm = {
  client_name: '',
  project_location: '',
  building_name: '',
  site_description: '',
  intended_purpose: '',
  racking_known: false,
  racking_source: '',
  occupancy_known: false,
  occupancy_source: '',
  occupancy_reference: '',
  has_undercroft: false,
  office_storeys: '',
  office_height: '',
  staircases: '',
  number_of_doors: '',
  door_width_mm: '',
};

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Wire payload for the report request: numbers parsed, blanks kept as blanks. */
export function toReportDetails(form: ReportDetailsForm): ReportDetails {
  return {
    client_name: form.client_name.trim(),
    project_location: form.project_location.trim(),
    building_name: form.building_name.trim(),
    site_description: form.site_description.trim(),
    intended_purpose: form.intended_purpose.trim(),
    racking_known: form.racking_known,
    racking_source: form.racking_source.trim(),
    occupancy_known: form.occupancy_known,
    occupancy_source: form.occupancy_source.trim(),
    occupancy_reference: form.occupancy_reference.trim(),
    has_undercroft: form.has_undercroft,
    office_storeys: optionalNumber(form.office_storeys),
    office_height: form.office_height.trim(),
    staircases: optionalNumber(form.staircases),
    number_of_doors: optionalNumber(form.number_of_doors),
    door_width_mm: optionalNumber(form.door_width_mm),
  };
}
