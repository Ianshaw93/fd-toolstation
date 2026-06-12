'use client';

import { useState } from 'react';
import type { TextBlock } from '../../lib/fee-types';

export const NAME_STORAGE_KEY = 'feeProposalEditorName';

export function rememberedName(): string {
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

interface Props {
  block: TextBlock;
  /** The new wording that will become the permanent default. */
  content: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (editorName: string) => void;
}

/**
 * GitHub-style confirmation for a permanent, all-future-proposals change.
 * Deliberately hard: the user must (1) say who they are and (2) re-type the
 * block's name exactly, so a default is never changed by a stray click.
 */
export default function ConfirmSaveDefaultModal({
  block,
  content,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: Props) {
  // Remember who's editing across blocks so it's typed once per session. Safe to
  // read during init: this modal only mounts after a client interaction.
  const [name, setName] = useState<string>(rememberedName);
  const [phrase, setPhrase] = useState('');

  const nameOk = name.trim().length > 0;
  const phraseOk = phrase.trim() === block.label;
  const canConfirm = nameOk && phraseOk && !busy;

  const handleConfirm = () => {
    if (!canConfirm) return;
    try {
      window.localStorage.setItem(NAME_STORAGE_KEY, name.trim());
    } catch {
      /* ignore */
    }
    onConfirm(name.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Save “${block.label}” as the default`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Save “{block.label}” as the default?</h3>
        <p className="mt-1 text-sm text-gray-600">
          This replaces the wording for <strong>all future proposals</strong>, not just this one.
          The change is recorded against your name and can be reverted from history.
        </p>

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">New default</p>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{content}</p>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="confirm-editor-name" className="mb-1 block text-sm font-medium text-gray-700">
              Your name
            </label>
            <input
              id="confirm-editor-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recorded against this change"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div>
            <label htmlFor="confirm-phrase" className="mb-1 block text-sm font-medium text-gray-700">
              Type <span className="font-mono text-gray-900">{block.label}</span> to confirm
            </label>
            <input
              id="confirm-phrase"
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 font-mono"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-900 hover:bg-gray-200 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Make this the new default'}
          </button>
        </div>
      </div>
    </div>
  );
}
