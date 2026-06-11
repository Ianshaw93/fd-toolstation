'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchTextBlocks } from '../../lib/fee-api';
import type { TextBlock } from '../../lib/fee-types';
import { relevantGroupsForState, type ProposalStageState } from '../../lib/fee-text-groups';
import CollapsibleSection from './CollapsibleSection';

interface Props {
  state: ProposalStageState;
  overrides: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

export default function ProposalTextOverrides({ state, overrides, onChange }: Props) {
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchTextBlocks()
      .then(setBlocks)
      .catch((err) => setLoadError(err.message));
  }, []);

  const relevant = useMemo(() => relevantGroupsForState(state), [state]);

  const grouped = useMemo(() => {
    const visible = blocks
      .filter((b) => relevant.has(b.group_name))
      .sort((a, b) => a.sort_order - b.sort_order);
    const map = new Map<string, TextBlock[]>();
    for (const b of visible) {
      if (!map.has(b.group_name)) map.set(b.group_name, []);
      map.get(b.group_name)!.push(b);
    }
    return map;
  }, [blocks, relevant]);

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
