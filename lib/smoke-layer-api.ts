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

/** Which Word deliverable to render: the full report, or the standalone calculation appendix. */
export type ReportDocument = 'report' | 'appendix';

/** The download name the backend suggested, if it sent one. */
function suggestedFilename(res: Response): string | null {
  const header = res.headers.get('Content-Disposition') ?? '';
  const match = header.match(/filename="?([^";]+)"?/);
  return match ? match[1] : null;
}

async function failure(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({ detail: fallback }));
  throw new Error(body.detail || fallback);
}

/**
 * POST the project and its buildings and download the Word file. One building gives
 * the single-building document, more the multi-building one; `documentType` picks
 * the report or the standalone calculation appendix.
 */
export async function generateSmokeLayerReport(
  data: ReportRequest,
  documentType: ReportDocument = 'report',
): Promise<void> {
  const res = await fetch(`${API_URL}/smoke-layer/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, document: documentType }),
  });

  if (!res.ok) await failure(res, `Failed to generate ${documentType}`);

  const blob = await res.blob();
  const name = data.project_name.trim().replace(/\s+/g, '_') || 'Warehouse';
  const fallback = documentType === 'appendix' ? `${name}_Smoke_Layer_Appendix.docx` : `${name}_Smoke_Layer.docx`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedFilename(res) ?? fallback;
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
