'use client';

import type { FillSource, Provenance } from '../../lib/field-provenance';

const LABELS: Record<FillSource, string> = {
  synergy: 'From Total Synergy',
  microsoft: 'From Microsoft sign-in',
  contact: 'Selected company contact',
};

const WAS: Record<FillSource, string> = {
  synergy: 'was from Total Synergy',
  microsoft: 'was from Microsoft sign-in',
  contact: 'was a selected company contact',
};

/** Compact per-field "where this came from" tag. Text, not colour, carries the meaning. */
export default function SourceBadge({ provenance, testId }: { provenance: Provenance | null | undefined; testId: string }) {
  if (!provenance) return null;
  if (provenance.kind === 'edited') {
    return (
      <span data-testid={testId} title={WAS[provenance.was]} className="shrink-0 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] leading-none text-gray-600">
        Edited by you<span className="sr-only"> ({WAS[provenance.was]})</span>
      </span>
    );
  }
  const review = provenance.kind === 'synergy' && provenance.review?.length;
  return (
    <span
      data-testid={testId}
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] leading-none ${
        review ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-sky-800'
      }`}
    >
      {LABELS[provenance.kind]}
      {review ? ' · check' : ''}
    </span>
  );
}
