'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchTextBlocks } from '../../lib/fee-api';
import type { TextBlock } from '../../lib/fee-types';
import CollapsibleSection from './CollapsibleSection';
import ManageTextBlockEditor from './ManageTextBlockEditor';

/**
 * The full library of standard wording, grouped and editable. Shared by the
 * builder's slide-out drawer and the standalone Manage Proposal Text route so
 * there is a single management surface, however it's reached.
 */
export default function ManageTextBlockList() {
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTextBlocks()
      .then(setBlocks)
      .catch((err) => setError(err.message));
  }, []);

  const grouped = useMemo(() => {
    const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order);
    const map = new Map<string, TextBlock[]>();
    for (const b of sorted) {
      if (!map.has(b.group_name)) map.set(b.group_name, []);
      map.get(b.group_name)!.push(b);
    }
    return map;
  }, [blocks]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
    );
  }
  if (blocks.length === 0) {
    return <p className="text-sm text-gray-400">Loading text blocks…</p>;
  }

  return (
    <>
      {[...grouped.entries()].map(([group, groupBlocks]) => (
        <CollapsibleSection key={group} title={group} defaultOpen={false}>
          <div className="space-y-5">
            {groupBlocks.map((block) => (
              // editorName is the fallback for reset/restore; saving a new default
              // captures the name in the confirmation dialog itself.
              <ManageTextBlockEditor key={block.key} block={block} editorName="" />
            ))}
          </div>
        </CollapsibleSection>
      ))}
    </>
  );
}
