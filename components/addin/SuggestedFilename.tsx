'use client';

import { useEffect, useState } from 'react';
import { createNamedFeeProposalDocument, type NamedProposalResult } from '../../lib/word-ops';

export function suggestedFilenameNote(documentSaved: boolean | null): string {
  if (documentSaved === true) {
    return 'This document is already saved, so Word cannot rename it. Copy the name and rename the file.';
  }
  if (documentSaved === false) {
    return 'Word will suggest this name when you save.';
  }
  return 'Copy this name and use it as the filename when you save.';
}

async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Word's webview sometimes rejects the async clipboard API; the selection fallback covers it.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  if (!ok) throw new Error('Could not copy the filename');
}

interface Props {
  filename: string;
  /** True when the open Word file already has a path or URL. Null outside Word. */
  documentSaved: boolean | null;
  /** Document creation handler. Defaults to createNamedFeeProposalDocument from word-ops. */
  onCreateNamedDocument?: (filename: string) => Promise<NamedProposalResult>;
}

export default function SuggestedFilename({
  filename,
  documentSaved,
  onCreateNamedDocument = createNamedFeeProposalDocument,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<NamedProposalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCopied(false);
    setResult(null);
    setError(null);
  }, [filename]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await onCreateNamedDocument(filename);
      setResult(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not create named fee proposal document.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const note = suggestedFilenameNote(documentSaved);
  const copyLabel = copied ? 'Copied suggested filename' : 'Copy suggested filename';

  return (
    <div className="border-t border-sky-200 pt-2 space-y-2" data-testid="suggested-filename-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-sky-800">Suggested filename</span>
        <button
          type="button"
          onClick={() => {
            void copyText(filename).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
          className="shrink-0 text-xs font-medium text-sky-800 underline"
          aria-label={copyLabel}
          aria-describedby="suggested-filename-note"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p data-testid="suggested-filename" className="text-xs text-gray-900 break-words">
        {filename}
      </p>
      <p id="suggested-filename-note" data-testid="suggested-filename-note" className="text-xs text-gray-600">
        {note}
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={handleCreate}
        className="w-full rounded-md bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Creating proposal…' : 'Create named proposal'}
      </button>

      {result?.saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-2 text-xs text-emerald-900 space-y-1" role="status">
          <p className="font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            Saved as {result.filename}. Move it to the project folder (e.g. Dropbox).
          </p>
          {result.savedLocation && (
            <p className="text-2xs text-emerald-800 break-all font-mono">
              Location: {result.savedLocation}
            </p>
          )}
        </div>
      )}

      {result && !result.saved && (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 p-2 text-xs text-amber-900 space-y-1" role="status">
          <p className="font-medium">
            Opened in a new document. Save As and use the copied filename.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
