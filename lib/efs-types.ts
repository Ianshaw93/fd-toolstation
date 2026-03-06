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
