/**
 * Backend calls for the warehouse smoke layer tool.
 *
 * The zone model itself runs in the browser (lib/smoke-layer-calc.ts). The
 * backend never recomputes it — the report endpoint is handed the results that
 * were on screen and only formats them, so the document and the charts the
 * engineer signed off can never disagree.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://backendfornextapp-production.up.railway.app';

import type { ReportRequest, SmokeLayerDocument } from './smoke-layer-project';
import type { SavedRun } from './smoke-layer-types';

export type { ReportRequest } from './smoke-layer-project';

async function failure(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({ detail: fallback }));
  throw new Error(body.detail || fallback);
}

/** POST the project and its buildings; one building gives the single-building report. */
export async function generateSmokeLayerReport(data: ReportRequest): Promise<void> {
  const res = await fetch(`${API_URL}/smoke-layer/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) await failure(res, 'Failed to generate report');

  const blob = await res.blob();
  const name = data.project_name.trim().replace(/\s+/g, '_') || 'Warehouse';
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}_Smoke_Layer.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function listSavedRuns(): Promise<SavedRun[]> {
  const res = await fetch(`${API_URL}/smoke-layer/runs`);
  if (!res.ok) await failure(res, 'Failed to load saved runs');
  return res.json();
}

/** Save the whole form document (project, shared assumptions, buildings) under a name. */
export async function saveRun(
  name: string,
  projectName: string,
  document: SmokeLayerDocument,
): Promise<SavedRun> {
  const res = await fetch(`${API_URL}/smoke-layer/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, project_name: projectName, inputs: document }),
  });
  if (!res.ok) await failure(res, 'Failed to save');
  return res.json();
}

export async function deleteRun(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/smoke-layer/runs/${id}`, { method: 'DELETE' });
  if (!res.ok) await failure(res, 'Failed to delete');
}
