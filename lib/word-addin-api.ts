// Backend calls for the Word add-in pane. Same-origin via the /backend rewrite in
// next.config.ts, so they work inside Word's https webview without CORS or mixed content.

const BACKEND = '/backend/word';

export interface Section {
  id: string;
  label: string;
  group: string;
  description: string;
}

export interface Source {
  id: string;
  label: string;
  entry: string;
  aliases: string[];
}

export interface Proposal {
  paragraph: number;
  source_id: string;
  label: string;
  anchor: string;
  confidence: 'high' | 'medium' | 'low';
  tier: 'alias' | 'llm';
}

export interface ScanResult {
  proposals: Proposal[];
  stats: { paragraphs: number; llm_calls: number; llm_seconds: number; model: string | null };
}

async function asError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({ detail: fallback }));
  return new Error(body.detail || fallback);
}

async function docxBase64(res: Response, fallback: string): Promise<string> {
  if (!res.ok) throw await asError(res, fallback);
  const buf = await res.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function fetchSections(): Promise<Section[]> {
  const res = await fetch(`${BACKEND}/sections`);
  if (!res.ok) throw await asError(res, 'Failed to load sections');
  return res.json();
}

export async function fetchSources(): Promise<Source[]> {
  const res = await fetch(`${BACKEND}/references`);
  if (!res.ok) throw await asError(res, 'Failed to load references');
  return res.json();
}

export async function renderSection(id: string): Promise<string> {
  const res = await fetch(`${BACKEND}/sections/${id}/render`, { method: 'POST' });
  return docxBase64(res, `Failed to render ${id}`);
}

export async function fetchTemplate(name: string): Promise<string> {
  const res = await fetch(`${BACKEND}/templates/${name}`);
  return docxBase64(res, `Failed to fetch template ${name}`);
}

export async function renderReferences(order: string[]): Promise<string> {
  const res = await fetch(`${BACKEND}/references/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  });
  return docxBase64(res, 'Failed to render references');
}

export async function matchEntries(entries: string[]): Promise<{ entry: string; source_id: string | null }[]> {
  const res = await fetch(`${BACKEND}/references/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) throw await asError(res, 'Failed to match entries');
  return res.json();
}

// --- fee proposal -------------------------------------------------------------------

import type { Engineer, FeeProposalRequest } from './fee-types';

export async function fetchEngineersViaProxy(): Promise<Engineer[]> {
  const res = await fetch('/backend/fee-proposals/engineers');
  if (!res.ok) throw await asError(res, 'Failed to load engineers');
  return res.json();
}

/**
 * The whole fee letter as a docx (base64). Prefers the add-in endpoint (fragment-safe for
 * insertion); falls back to the web tool's generate endpoint on a backend that predates it,
 * which is enough for "New document".
 */
export async function renderFeeProposal(data: FeeProposalRequest): Promise<string> {
  const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  let res = await fetch(`${BACKEND}/fee-proposal/render`, init);
  if (res.status === 404) res = await fetch('/backend/fee-proposals/generate', init);
  return docxBase64(res, 'Failed to render the fee proposal');
}

export async function scanCitations(
  paragraphs: { index: number; text: string }[],
  llm: boolean,
): Promise<ScanResult> {
  const res = await fetch(`${BACKEND}/citations/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paragraphs, llm }),
  });
  if (!res.ok) throw await asError(res, 'Scan failed');
  return res.json();
}
