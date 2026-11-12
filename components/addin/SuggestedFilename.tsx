'use client';

import { useEffect, useState } from 'react';
import type { NamedProposalResult } from '../../lib/word-ops';

export function suggestedFilenameNote(documentSaved: boolean | null): string {
  if (documentSaved === true) {
    return 'This document is already saved, so Word cannot rename it. Copy the name and rename the file.';
  }
  if (documentSaved === false) {
    return "Word won't suggest this name when you save. Copy it, then paste it into the file name box in Save As.";
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
  suggestedFilename?: string | null;
  onChange?: (newFilename: string) => void;
  onReset?: () => void;
  /** True when the open Word file already has a path or URL. Null outside Word. */
  documentSaved: boolean | null;
  savedResult?: NamedProposalResult | null;
}

export default function SuggestedFilename({
  filename,
  suggestedFilename,
  onChange,
  onReset,
  documentSaved,
  savedResult,
}: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const note = suggestedFilenameNote(documentSaved);
  const copyLabel = copied ? 'Copied suggested filename' : 'Copy suggested filename';
  const isCustomized = Boolean(suggestedFilename && filename !== suggestedFilename);

  return (
    <div className="border-t border-sky-200 pt-2 space-y-2" data-testid="suggested-filename-card">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="proposal-filename-input" className="text-xs font-semibold text-sky-800">
          Suggested filename
        </label>
        <div className="flex items-center gap-2">
          {isCustomized && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-sky-700 hover:text-sky-900 underline"
            >
              Reset
            </button>
          )}
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
      </div>

      <input
        id="proposal-filename-input"
        data-testid="suggested-filename"
        type="text"
        value={filename}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        aria-describedby="suggested-filename-note"
      />

      <p id="suggested-filename-note" data-testid="suggested-filename-note" className="text-xs text-gray-600">
        {note}
      </p>

      {savedResult?.saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-2 text-xs text-emerald-900 space-y-1" role="status">
          <div className="flex items-start gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
            <span data-testid="saved-result-message">
              Saved as <span className="font-semibold">{savedResult.filename}</span>. Move it to the project folder (e.g. Dropbox).
            </span>
          </div>
          {savedResult.savedLocation && (
            <div className="text-2xs text-emerald-700 truncate font-mono pl-3" title={savedResult.savedLocation}>
              Location: {savedResult.savedLocation}
            </div>
          )}
        </div>
      )}

      {savedResult && !savedResult.saved && (
        <div className="rounded-md border border-sky-200 bg-sky-50/80 p-2 text-xs text-sky-900 flex items-start gap-1.5 font-medium" role="status">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-600 mt-1 shrink-0" />
          <span>Opened in a new document. Save As and use the copied filename.</span>
        </div>
      )}
    </div>
  );
}
