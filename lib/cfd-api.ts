const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backendfornextapp-production.up.railway.app';

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
}

export interface CfdDashboardState {
  runner: {
    status: 'online' | 'idle' | 'offline';
    last_heartbeat: string | null;
  };
  current: CfdSimulation | null;
  queue: CfdSimulation[];
  completed: CfdSimulation[];
  errors: CfdSimulation[];
}

export async function fetchDashboardState(): Promise<CfdDashboardState> {
  const res = await fetch(`${API_URL}/cfd-dashboard/state`);
  if (!res.ok) {
    throw new Error('Failed to fetch dashboard state');
  }
  return res.json();
}
