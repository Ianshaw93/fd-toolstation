const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backendfornextapp-production.up.railway.app';

import type { EfsRequest, EfsResponse } from './efs-types';

export async function calculateEfs(data: EfsRequest): Promise<EfsResponse> {
  const res = await fetch(`${API_URL}/efs/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Calculation failed');
  }

  return res.json();
}
