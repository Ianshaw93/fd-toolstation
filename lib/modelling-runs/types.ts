export type RunStatus = 'queued' | 'running' | 'stopped' | 'failed' | 'completed';
export type RunTarget = 'local' | 'cloudhpc';
export type MachineStatus = 'online' | 'idle' | 'offline';

export interface Machine {
  id: string;
  name: string;
  target_type: RunTarget;
  last_heartbeat_at: string | null;
  status: MachineStatus;
}

export interface RunEvent {
  id: string;
  run_id: string | null;
  machine_id: string | null;
  event_type: string;
  message: string | null;
  payload: unknown;
  created_at: string | null;
}

/** Flat run object returned by GET /runs/{id}, POST /runs, and each list row. */
export interface ModellingRun {
  id: string;
  target: RunTarget;
  machine_id: string | null;
  machine_name: string | null;
  case_name: string;
  input_file_ref: string | null;
  status: RunStatus;
  progress_pct: number | null;
  sim_time: number | null;
  end_time: number | null;
  started_at: string | null;
  ended_at: string | null;
  error: string | null;
  results_link: string | null;
  cost_estimate: number | null;
  cost_actual: number | null;
  cost_currency: string | null;
  created_by: string | null;
  external_id: string | null;
  created_at: string | null;
  command_id?: string;
  events?: RunEvent[];
}

export interface RunFilters {
  target?: string;
  machine_id?: string;
  status?: string;
  q?: string;
  user?: string;
}
