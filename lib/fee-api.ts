const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backendfornextapp-production.up.railway.app';

import type { Engineer, FeeProposalRequest, TextBlock, TextBlockHistoryEntry } from './fee-types';

export async function fetchEngineers(): Promise<Engineer[]> {
  const res = await fetch(`${API_URL}/fee-proposals/engineers`);
  if (!res.ok) throw new Error('Failed to fetch engineers');
  return res.json();
}

async function asError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({ detail: fallback }));
  return new Error(body.detail || fallback);
}

export async function fetchTextBlocks(): Promise<TextBlock[]> {
  const res = await fetch(`${API_URL}/fee-proposals/text-blocks`);
  if (!res.ok) throw await asError(res, 'Failed to fetch text blocks');
  return res.json();
}

/** Dry run: which text-block keys this request would actually render. */
export async function fetchApplicableTextBlocks(data: FeeProposalRequest): Promise<string[]> {
  const res = await fetch(`${API_URL}/fee-proposals/applicable-text-blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await asError(res, 'Failed to resolve applicable text blocks');
  return res.json();
}

export async function updateTextBlock(key: string, content: string, editedBy: string): Promise<TextBlock> {
  const res = await fetch(`${API_URL}/fee-proposals/text-blocks/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, edited_by: editedBy }),
  });
  if (!res.ok) throw await asError(res, 'Failed to save text block');
  return res.json();
}

export async function resetTextBlock(key: string, editedBy: string): Promise<TextBlock> {
  const res = await fetch(`${API_URL}/fee-proposals/text-blocks/${key}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edited_by: editedBy }),
  });
  if (!res.ok) throw await asError(res, 'Failed to reset text block');
  return res.json();
}

export async function fetchTextBlockHistory(key: string): Promise<TextBlockHistoryEntry[]> {
  const res = await fetch(`${API_URL}/fee-proposals/text-blocks/${key}/history`);
  if (!res.ok) throw await asError(res, 'Failed to fetch history');
  return res.json();
}

export async function restoreTextBlock(key: string, historyId: number, editedBy: string): Promise<TextBlock> {
  const res = await fetch(`${API_URL}/fee-proposals/text-blocks/${key}/restore/${historyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edited_by: editedBy }),
  });
  if (!res.ok) throw await asError(res, 'Failed to restore version');
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
