'use client';

import { useEffect, useState } from 'react';

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
}

export default function SuggestedFilename({ filename, documentSaved }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [filename]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const note = suggestedFilenameNote(documentSaved);
  const copyLabel = copied ? 'Copied suggested filename' : 'Copy suggested filename';

  return (
    <div className="border-t border-sky-200 pt-2 space-y-1" data-testid="suggested-filename-card">
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
    </div>
  );
}
