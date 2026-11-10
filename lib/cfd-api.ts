export interface CfdSimulation {
  id: number;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  meshes: number | null;
  t_end: number | null;
  progress_pct: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_msg: string | null;
  updated_at: string | null;
  machine_name: string | null;
}

export interface CfdDashboardState {
  runner: {
    status: 'online' | 'idle' | 'offline';
    last_heartbeat: string | null;
    machine_name: string | null;
  };
  current: CfdSimulation | null;
  queue: CfdSimulation[];
  completed: CfdSimulation[];
  errors: CfdSimulation[];
}

export async function fetchDashboardState(): Promise<CfdDashboardState> {
  const res = await fetch('/api/cfd-dashboard/state', { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      body && typeof body === 'object' && typeof (body as { detail?: unknown }).detail === 'string'
        ? (body as { detail: string }).detail
        : 'Failed to fetch dashboard state';
    throw new Error(detail);
  }
  return body as CfdDashboardState;
}
