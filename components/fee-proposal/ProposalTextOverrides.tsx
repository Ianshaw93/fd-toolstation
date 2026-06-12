'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchTextBlocks, fetchApplicableTextBlocks, updateTextBlock } from '../../lib/fee-api';
import type { TextBlock, FeeProposalRequest } from '../../lib/fee-types';
import { relevantGroupsForState } from '../../lib/fee-text-groups';
import CollapsibleSection from './CollapsibleSection';
import ConfirmSaveDefaultModal from './ConfirmSaveDefaultModal';
import TextBlockPreview from './TextBlockPreview';

interface Props {
  request: FeeProposalRequest;
  overrides: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

export default function ProposalTextOverrides({ request, overrides, onChange }: Props) {
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Exact keys the proposal will render (from the backend dry run); null = fall
  // back to the coarser group-level filter until/if the dry run resolves.
  const [applicableKeys, setApplicableKeys] = useState<Set<string> | null>(null);
  // The block whose edited wording the user is about to promote to a default.
  const [pendingDefault, setPendingDefault] = useState<TextBlock | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchTextBlocks()
      .then(setBlocks)
      .catch((err) => setLoadError(err.message));
  }, []);

  // Re-run the dry run when the service selection / country changes (debounced).
  const selectionSig = JSON.stringify({
    s14: request.design_stages_1_4,
    s5: request.design_stages_5,
    s6: request.design_stages_6,
    country: request.project.country,
  });
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetchApplicableTextBlocks(request)
        .then((keys) => { if (!cancelled) setApplicableKeys(new Set(keys)); })
        .catch(() => { if (!cancelled) setApplicableKeys(null); }); // fall back
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionSig]);

  const grouped = useMemo(() => {
    const relevantGroups = relevantGroupsForState(request);
    const isVisible = (b: TextBlock) =>
      applicableKeys ? applicableKeys.has(b.key) : relevantGroups.has(b.group_name);

    const visible = blocks.filter(isVisible).sort((a, b) => a.sort_order - b.sort_order);
    const map = new Map<string, TextBlock[]>();
    for (const b of visible) {
      if (!map.has(b.group_name)) map.set(b.group_name, []);
      map.get(b.group_name)!.push(b);
    }
    return map;
  }, [blocks, applicableKeys, request]);

  const saveAsDefault = async (editorName: string) => {
    if (!pendingDefault) return;
    const block = pendingDefault;
    const content = overrides[block.key] ?? block.content;
    setSavingDefault(true);
    setSaveError(null);
    try {
      const updated = await updateTextBlock(block.key, content, editorName);
      // Reflect the new default locally so the editor stops flagging it as changed.
      setBlocks((prev) => prev.map((b) => (b.key === updated.key ? { ...b, content: updated.content } : b)));
      // The per-proposal override now equals the default — drop it.
      const next = { ...overrides };
      delete next[block.key];
      onChange(next);
      setPendingDefault(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save default');
    } finally {
      setSavingDefault(false);
    }
  };

  const setOverride = (block: TextBlock, value: string) => {
    const next = { ...overrides };
    if (value === block.content) {
      delete next[block.key]; // unchanged -> don't send
    } else {
      next[block.key] = value;
    }
    onChange(next);
  };

  if (loadError) {
    return (
      <p className="text-sm text-gray-500">
        Couldn&apos;t load editable text ({loadError}). The proposal will use the standard wording.
      </p>
    );
  }
  if (blocks.length === 0) return <p className="text-sm text-gray-400">Loading editable text…</p>;
  if (grouped.size === 0) {
    return <p className="text-sm text-gray-400">Select services above to customise their wording here.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Edits here apply to <strong>this proposal only</strong>. To make a change stick for every
        future proposal, use <strong>Save as default</strong> beneath the edited wording. Only
        wording that will appear in this proposal is shown.
      </p>
      {[...grouped.entries()].map(([group, groupBlocks]) => (
        <CollapsibleSection key={group} title={group} defaultOpen={false}>
          <div className="space-y-4">
            {groupBlocks.map((block) => {
              const value = overrides[block.key] ?? block.content;
              const changed = block.key in overrides;
              return (
                <div key={block.key}>
                  <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                    <span>{block.label}</span>
                    {changed && <span className="text-xs text-amber-600">edited</span>}
                  </label>
                  {block.kind === 'bullet_list' && (
                    <p className="text-xs text-gray-400 mb-1">One bullet per line.</p>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <textarea
                      value={value}
                      onChange={(e) => setOverride(block, e.target.value)}
                      rows={block.kind === 'bullet_list' ? 5 : 3}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 font-mono"
                    />
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                        How it reads in the report
                      </p>
                      <TextBlockPreview kind={block.kind} content={value} placeholders={block.placeholders} />
                    </div>
                  </div>
                  {changed && (
                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => setPendingDefault(block)}
                        className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2"
                      >
                        Save as default…
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      ))}

      {pendingDefault && (
        <ConfirmSaveDefaultModal
          block={pendingDefault}
          content={overrides[pendingDefault.key] ?? pendingDefault.content}
          busy={savingDefault}
          error={saveError}
          onCancel={() => { setPendingDefault(null); setSaveError(null); }}
          onConfirm={saveAsDefault}
        />
      )}
    </div>
  );
}
