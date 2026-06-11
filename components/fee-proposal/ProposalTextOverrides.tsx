'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchTextBlocks, fetchApplicableTextBlocks } from '../../lib/fee-api';
import type { TextBlock, FeeProposalRequest } from '../../lib/fee-types';
import { relevantGroupsForState } from '../../lib/fee-text-groups';
import CollapsibleSection from './CollapsibleSection';

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
        Edits here apply to <strong>this proposal only</strong> and are not saved as defaults.
        Only wording that will appear in this proposal is shown.
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
                  <textarea
                    value={value}
                    onChange={(e) => setOverride(block, e.target.value)}
                    rows={block.kind === 'bullet_list' ? 5 : 3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 font-mono"
                  />
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
}
