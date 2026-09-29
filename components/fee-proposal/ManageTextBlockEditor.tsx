'use client';

import { useState } from 'react';
import { fetchTextBlockHistory, resetTextBlock, restoreTextBlock, updateTextBlock } from '../../lib/fee-api';
import type { TextBlock, TextBlockHistoryEntry } from '../../lib/fee-types';

interface Props { block: TextBlock; editorName: string; }

export default function ManageTextBlockEditor({ block, editorName }: Props) {
  const [content, setContent] = useState(block.content);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [history, setHistory] = useState<TextBlockHistoryEntry[] | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const dirty = content !== block.content;

  const requireName = () => {
    const name = editorName.trim();
    if (!name) { setMessage({ kind: 'err', text: 'Enter your name above before saving.' }); return null; }
    return name;
  };

  const run = async (action: () => Promise<TextBlock>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await action();
      block.content = updated.content;
      setContent(updated.content);
      setMessage({ kind: 'ok', text: success });
      if (history) setHistory(await fetchTextBlockHistory(block.key));
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally { setBusy(false); }
  };

  const save = () => {
    const name = requireName();
    if (!name) return;
    setConfirmSave(false);
    void run(() => updateTextBlock(block.key, content, name), 'Saved as the default wording.');
  };
  const reset = () => {
    const name = requireName();
    if (name) void run(() => resetTextBlock(block.key, name), 'Reset to original wording.');
  };
  const toggleHistory = async () => {
    if (history) { setHistory(null); return; }
    try { setHistory(await fetchTextBlockHistory(block.key)); }
    catch (err) { setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Could not load history.' }); }
  };
  const restore = (id: number) => {
    const name = requireName();
    if (name) void run(() => restoreTextBlock(block.key, id, name), 'Restored the selected version.');
  };

  return (
    <div className="border-b border-gray-100 pb-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-800">{block.label}</span>
        <div className="flex flex-wrap justify-end gap-1">
          {block.placeholders.map((placeholder) => <code key={placeholder} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{'{' + placeholder + '}'}</code>)}
        </div>
      </div>
      {block.kind === 'bullet_list' && <p className="mb-1 text-xs text-gray-500">Put each bullet point on a separate line.</p>}
      {block.placeholders.length > 0 && <p className="mb-1 text-xs text-gray-500">Keep the placeholders shown above; they are filled in when a proposal is generated.</p>}
      <textarea aria-label={`Wording for ${block.label}`} value={content} onChange={(event) => setContent(event.target.value)} rows={block.kind === 'bullet_list' ? 5 : 4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setConfirmSave(true)} disabled={busy || !dirty} className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-40">Save as default</button>
        <button type="button" onClick={reset} disabled={busy} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-200 disabled:opacity-40">Reset</button>
        <button type="button" onClick={toggleHistory} disabled={busy} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-200 disabled:opacity-40">{history ? 'Hide history' : 'History'}</button>
        {message && <span role="status" className={`text-xs ${message.kind === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{message.text}</span>}
      </div>
      {confirmSave && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Update default proposal wording?</h3>
            <p className="mt-2 text-sm text-gray-600">This wording will be used in future fee proposals for everyone. A previous version will be kept in history.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmSave(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">Cancel</button>
              <button type="button" onClick={save} className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white">Save wording</button>
            </div>
          </div>
        </div>
      )}
      {history && <div className="mt-3 space-y-2">
        {history.length === 0 && <p className="text-xs text-gray-500">No saved versions yet.</p>}
        {history.map((entry) => <div key={entry.id} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 text-xs">
          <div className="min-w-0 flex-1"><div className="text-gray-500">{entry.edited_by}{entry.created_at ? ` · ${new Date(entry.created_at).toLocaleString()}` : ''}</div><div className="mt-1 line-clamp-4 whitespace-pre-wrap text-gray-800">{entry.content}</div></div>
          <button type="button" onClick={() => restore(entry.id)} disabled={busy} className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-100 disabled:opacity-40">Restore</button>
        </div>)}
      </div>}
    </div>
  );
}
