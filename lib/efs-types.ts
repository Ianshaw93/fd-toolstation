export interface ProjectDetails {
  projectName: string;
  projectLocation: string;
  ribaDesignStage: string;
  engineerName: string;
  clientName: string;
}

export interface BuildingOverview {
  hasSuppression: boolean;
  suppressionStandard: string;
  fireAlarmCategory: string;
  investigationPeriod: boolean;
  requiredFireResistance: string;
}

export const AREA_USE_TYPES = [
  'Warehouse',
  'Office',
  'Store Room',
  'Canteen',
  'Kitchen',
  'Vehicle Maintenance Workshop',
  'Locker Room',
  'Changing Room',
  'Rooftop Plant Area',
  'Plant Area',
] as const;

export type AreaUseType = typeof AREA_USE_TYPES[number];

export interface HorizontalEscapeRow {
  name: string;
  use: string;
  exitWidths: (number | '')[];
}

export interface VerticalEscapeRow {
  stairName: string;
  widthMm: number | '';
  numFloorsServed: number | '';
  useServed: string;
  singleStairAccess: boolean;
}

export const INTERNAL_SPREAD_ELEMENTS = [
  'Stairs which protrude from the side of the building',
  'Stair Lobbies',
  'Dead End Corridors',
  'Subdivision of Corridors',
  'Storage Areas Less than 450m² in Area',
  'Storage Areas Greater than 450m² in Area',
  'Workshops',
  'Kitchens',
  'Changing Areas',
  'Locker Rooms',
  'Boiler Rooms',
  'Medium or High Voltage Electrical Rooms',
  'Other Plant Rooms (High Risk)',
  'Other Plant Rooms (Low Risk)',
  'Refuse Storage Areas',
  'Substations',
] as const;

export type InternalSpreadElement = typeof INTERNAL_SPREAD_ELEMENTS[number];

export interface InternalSpreadData {
  fireSeparationRequired: boolean;
  fireSeparationPeriod: number;
  useStructuralFireEngineering: boolean;
  elementsPresent: Record<string, boolean>;
}

export interface Elevation {
  boundary_distance: number | '';
  height: number | '';
  width: number | '';
  has_suppression: boolean;
}

export interface EfsRequest {
  elevations: {
    boundary_distance: number;
    height: number;
    width: number;
    has_suppression: boolean;
  }[];
  is_commercial: boolean;
}

export interface ElevationResult {
  elevation_number: number;
  boundary_distance: string;
  er_height: string;
  er_width: string;
  bre_height: string;
  bre_width: string;
  bre_percentage: string;
  allowable_area: string;
  actual_area: string;
  actual_protected_area: string;
  actual_percentage: string;
}

export interface EfsResponse {
  elevations: ElevationResult[];
}
