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
  const [name, setName] = useState('');

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

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <div className="container mx-auto px-6 py-8 flex-1 max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Tools
        </Link>

        <div className="mb-6">
          <h1 className="text-4xl font-bold tracking-tight">Manage Proposal Text</h1>
          <p className="text-gray-600 text-sm mt-2">
            Edit the default wording used in every fee proposal. Changes here apply to{' '}
            <strong>all future proposals</strong>. Every change is recorded.
          </p>
        </div>

        <div className="mb-6 sticky top-0 bg-white py-3 z-10 border-b border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Required to save changes"
            className="w-full max-w-sm px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
        {!error && blocks.length === 0 && (
          <p className="text-sm text-gray-400">Loading text blocks…</p>
        )}

        {[...grouped.entries()].map(([group, groupBlocks]) => (
          <CollapsibleSection key={group} title={group} defaultOpen={false}>
            <div className="space-y-5">
              {groupBlocks.map((block) => (
                <ManageTextBlockEditor key={block.key} block={block} editorName={name} />
              ))}
            </div>
          </CollapsibleSection>
        ))}
      </div>

      <footer className="bg-blue-300 text-white py-6 px-6">
        <div className="container mx-auto">
          <h2 className="text-2xl font-semibold mb-1">Fire Dynamics</h2>
          <p className="text-sm">&copy; 2022 Fire Dynamics Group Limited | Company number: 13476929</p>
        </div>
      </footer>
    </div>
  );
}
