const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

import type { Engineer, FeeProposalRequest } from './fee-types';

export async function fetchEngineers(): Promise<Engineer[]> {
  const res = await fetch(`${API_URL}/fee-proposals/engineers`);
  if (!res.ok) throw new Error('Failed to fetch engineers');
  return res.json();
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
  const contentDisposition = res.headers.get('Content-Disposition');
  let filename = 'fee-proposal.docx';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) filename = match[1];
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
