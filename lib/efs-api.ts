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

export async function generateEfsReport(data: EfsRequest, projectName?: string): Promise<void> {
  const res = await fetch(`${API_URL}/efs/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to generate report');
  }

  const blob = await res.blob();
  const filename = projectName
    ? `EFS_Report_${projectName.replace(/\s+/g, '_')}.docx`
    : 'EFS_Report.docx';

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
