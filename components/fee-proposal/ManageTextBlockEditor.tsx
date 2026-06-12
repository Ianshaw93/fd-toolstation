'use client';

import { useState } from 'react';
import {
  updateTextBlock,
  resetTextBlock,
  fetchTextBlockHistory,
  restoreTextBlock,
} from '../../lib/fee-api';
import type { TextBlock, TextBlockHistoryEntry } from '../../lib/fee-types';
import ConfirmSaveDefaultModal, { rememberedName } from './ConfirmSaveDefaultModal';
import TextBlockPreview from './TextBlockPreview';

interface Props {
  block: TextBlock;
  editorName: string;
}

export default function ManageTextBlockEditor({ block, editorName }: Props) {
  const [content, setContent] = useState(block.content);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [history, setHistory] = useState<TextBlockHistoryEntry[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  const dirty = content !== block.content;

  const requireName = (): string | null => {
    const name = editorName.trim() || rememberedName();
    if (!name) {
      setMessage({ kind: 'err', text: 'Save a default once to record your name, then try again.' });
      return null;
    }
    return name;
  };

  const run = async (fn: () => Promise<TextBlock>, okText: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await fn();
      block.content = updated.content;
      setContent(updated.content);
      setMessage({ kind: 'ok', text: okText });
      if (history) setHistory(await fetchTextBlockHistory(block.key));
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setBusy(false);
    }
  };

  const saveAsDefault = async (name: string) => {
    await run(() => updateTextBlock(block.key, content, name), 'Saved as default.');
    setConfirming(false);
  };
  const handleReset = () => {
    const name = requireName();
    if (name) run(() => resetTextBlock(block.key, name), 'Reset to default.');
  };
  const toggleHistory = async () => {
    if (history) { setHistory(null); return; }
    try {
      setHistory(await fetchTextBlockHistory(block.key));
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong' });
    }
  };
  const handleRestore = (id: number) => {
    const name = requireName();
    if (name) run(() => restoreTextBlock(block.key, id, name), 'Restored version.');
  };

  return (
    <div className="border-b border-gray-100 pb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{block.label}</span>
        <div className="flex gap-1">
          {block.placeholders.map((p) => (
            <code key={p} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{`{${p}}`}</code>
          ))}
        </div>
      </div>
      {block.kind === 'bullet_list' && (
        <p className="text-xs text-gray-400 mb-1">One bullet per line.</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={block.kind === 'bullet_list' ? 5 : 3}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 font-mono"
        />
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
            How it reads in the report
          </p>
          <TextBlockPreview kind={block.kind} content={content} placeholders={block.placeholders} />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => setConfirming(true)}
          disabled={busy || !dirty}
          className="px-3 py-1.5 text-sm rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-40"
        >
          Save as default
        </button>
        <button
          onClick={handleReset}
          disabled={busy}
          className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-40"
        >
          Reset
        </button>
        <button
          onClick={toggleHistory}
          disabled={busy}
          className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-40"
        >
          {history ? 'Hide history' : 'History'}
        </button>
        {message && (
          <span className={`text-xs ${message.kind === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </span>
        )}
      </div>

      {history && (
        <div className="mt-3 space-y-2">
          {history.length === 0 && <p className="text-xs text-gray-400">No saved versions yet.</p>}
          {history.map((h) => (
            <div key={h.id} className="flex items-start gap-2 text-xs bg-gray-50 rounded-lg p-2">
              <div className="flex-1">
                <div className="text-gray-400">
                  {h.edited_by}{h.created_at ? ` · ${new Date(h.created_at).toLocaleString()}` : ''}
                </div>
                <div className="text-gray-700 whitespace-pre-wrap line-clamp-3">{h.content}</div>
              </div>
              <button
                onClick={() => handleRestore(h.id)}
                disabled={busy}
                className="px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}

      {confirming && (
        <ConfirmSaveDefaultModal
          block={block}
          content={content}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={saveAsDefault}
        />
      )}
    </div>
  );
}
