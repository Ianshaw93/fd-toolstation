const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

import type { Engineer, FeeProposalRequest } from './fee-types';

export async function fetchEngineers(): Promise<Engineer[]> {
  const res = await fetch(`${API_URL}/fee-proposals/engineers`);
  if (!res.ok) throw new Error('Failed to fetch engineers');
  return res.json();
}

function buildFilename(data: FeeProposalRequest): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${data.project.project_name} Fire Dynamics Fee Proposal ${dd}_${mm}_${yyyy}.docx`;
}

export async function generateProposal(data: FeeProposalRequest): Promise<void> {
  const res = await fetch(`${API_URL}/fee-proposals/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to generate proposal');
  }

  const blob = await res.blob();
  const filename = buildFilename(data);

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
