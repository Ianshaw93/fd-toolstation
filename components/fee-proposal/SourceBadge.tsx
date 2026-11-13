'use client';

import type { FillSource, Provenance } from '../../lib/field-provenance';

const LABELS: Record<FillSource, string> = {
  synergy: 'From Total Synergy',
  microsoft: 'From Microsoft sign-in',
  contact: 'Selected company contact',
  previous_fee: 'From previous fee',
};

const WAS: Record<FillSource, string> = {
  synergy: 'was from Total Synergy',
  microsoft: 'was from Microsoft sign-in',
  contact: 'was a selected company contact',
  previous_fee: 'was from a previous fee',
};

/** Compact per-field "where this came from" tag. Text, not colour, carries the meaning. */
export default function SourceBadge({ provenance, testId }: { provenance: Provenance | null | undefined; testId: string }) {
  if (!provenance) return null;
  if (provenance.kind === 'carried') {
    return (
      <span data-testid={testId} title={`Yours, from ${provenance.from}`} className="shrink-0 rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[11px] leading-none text-gray-700">
        Kept from previous project<span className="sr-only"> ({provenance.from})</span>
      </span>
    );
  }
  if (provenance.kind === 'edited') {
    return (
      <span data-testid={testId} title={WAS[provenance.was]} className="shrink-0 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] leading-none text-gray-600">
        Edited by you<span className="sr-only"> ({WAS[provenance.was]})</span>
      </span>
    );
  }
  const review = provenance.kind === 'synergy' && provenance.review?.length;
  const tone = review
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : provenance.kind === 'previous_fee'
      ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
      : 'border-sky-200 bg-sky-50 text-sky-800';
  return (
    <span
      data-testid={testId}
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] leading-none ${tone}`}
    >
      {LABELS[provenance.kind]}
      {review ? ' · check' : ''}
    </span>
  );
}
