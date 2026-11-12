'use client';

import type { Dispatch } from 'react';
import type { FieldProposal, ReviewField } from '../../lib/directory-proposals';
import { COUNTRIES } from '../../lib/fee-constants';

const NOUNS: Record<ReviewField, string> = {
  company: 'company',
  names: 'client name',
  address: 'address',
  projectName: 'project name',
  country: 'project country',
};

function shown(field: ReviewField, value: FieldProposal['value']): string[] {
  if (Array.isArray(value)) return value.filter((line) => line.trim() !== '');
  if (typeof value === 'object') return [[value.firstName, value.lastName].filter(Boolean).join(' ')];
  if (field === 'country') return [COUNTRIES.find((c) => c.value === value)?.label ?? value];
  return [value];
}

/**
 * Inline, non-modal choice for one field (or group): the linked project's value next to the
 * user's own. Either button can be used at any time, in any order with other fields.
 */
export default function FieldProposalReview({
  field,
  proposal,
  dispatch,
}: {
  field: ReviewField;
  proposal: FieldProposal | undefined;
  dispatch: Dispatch<{ type: 'RESOLVE_DIRECTORY_PROPOSAL'; field: ReviewField; choice: 'use' | 'keep' }>;
}) {
  if (!proposal) return null;
  const lines = shown(field, proposal.value);
  return (
    <div
      role="group"
      aria-label={`Suggested ${NOUNS[field]} from ${proposal.projectLabel}`}
      className="mt-1.5 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-2 text-xs text-gray-800"
    >
      <p className="text-gray-600">
        {proposal.projectLabel} in Total Synergy has a different {NOUNS[field]}:
      </p>
      <p className="mt-0.5 font-medium whitespace-pre-line">{lines.join('\n')}</p>
      {proposal.review?.length ? <p className="mt-0.5 text-amber-800">Synergy flags this address for review.</p> : null}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => dispatch({ type: 'RESOLVE_DIRECTORY_PROPOSAL', field, choice: 'use' })}
          className="rounded border border-gray-900 bg-gray-900 px-2 py-1 font-medium text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Use new value
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'RESOLVE_DIRECTORY_PROPOSAL', field, choice: 'keep' })}
          className="rounded border border-gray-300 bg-white px-2 py-1 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Keep mine
        </button>
      </div>
    </div>
  );
}
