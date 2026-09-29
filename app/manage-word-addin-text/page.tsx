'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchTextBlocks } from '../../lib/fee-api';
import type { TextBlock } from '../../lib/fee-types';
import CollapsibleSection from '../../components/fee-proposal/CollapsibleSection';
import ManageTextBlockEditor from '../../components/fee-proposal/ManageTextBlockEditor';

export default function ManageProposalTextPage() {
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  useEffect(() => {
    fetchTextBlocks()
      .then(setBlocks)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load proposal wording.'))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const result = new Map<string, TextBlock[]>();
    for (const block of [...blocks].sort((a, b) => a.sort_order - b.sort_order)) {
      if (!result.has(block.group_name)) result.set(block.group_name, []);
      result.get(block.group_name)!.push(block);
    }
    return result;
  }, [blocks]);

  const orderedGroups = useMemo(() => {
    const entries = [...grouped.entries()];
    const structuralGroupNames = [
      'Structural Fire Engineering',
      'TMA Structural Fire Engineering',
      'Time-Equivalency Structural Fire Engineering',
      'FEM Structural Fire Engineering',
    ];
    const structuralNames = new Set(structuralGroupNames);
    const structuralEntries = structuralGroupNames
      .map((name) => entries.find(([group]) => group === name))
      .filter((entry): entry is [string, TextBlock[]] => entry !== undefined);
    const structuralIndex = entries.findIndex(([group]) => group === 'Structural Fire Engineering');

    if (structuralIndex === -1) return entries;

    const remainingEntries = entries.filter(([group]) => !structuralNames.has(group));
    const insertIndex = entries
      .slice(0, structuralIndex)
      .filter(([group]) => !structuralNames.has(group)).length;
    remainingEntries.splice(insertIndex, 0, ...structuralEntries);
    return remainingEntries;
  }, [grouped]);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"><span aria-hidden="true">←</span> Back to tools</Link>
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Manage Word add-in proposal wording</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">Update wording used by the Word add-in when it generates fee proposals. These settings are separate from the web fee-proposal generator. Previous versions can be restored.</p>
        </header>
        <div className="sticky top-0 z-10 mb-6 border-b border-gray-200 bg-white py-3">
          <label htmlFor="editor-name" className="mb-1 block text-sm font-medium text-gray-700">Your name</label>
          <input id="editor-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name to save changes" className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          <p className="mt-1 text-xs text-gray-500">Your name is recorded with each change.</p>
        </div>
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {loading && <p className="text-sm text-gray-500">Loading wording…</p>}
        {!loading && !error && blocks.length === 0 && <p className="text-sm text-gray-500">No wording blocks are available.</p>}
        {orderedGroups.map(([group, groupBlocks]) => <CollapsibleSection key={group} title={group === 'Introductions' ? 'General Introductions' : group} defaultOpen={false}>
          <div className="space-y-5">{groupBlocks.map((block) => <ManageTextBlockEditor key={block.key} block={block} editorName={name} />)}</div>
        </CollapsibleSection>)}
      </div>
    </main>
  );
}
