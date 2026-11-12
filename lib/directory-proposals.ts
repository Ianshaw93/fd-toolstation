// Inline "Use new value / Keep mine" review for fields the user owns when a project's directory
// prefill offers something different. The shared merge already keeps user-owned values; this
// records what the project would have put there so the user can choose, field by field, in any
// order, with no dialog. Address and names are reviewed as groups so they are never mixed.

import type { FeeProposalPrefill, PrefillTarget } from './vendor/fd-directory-client';
import type { AddressReview } from './field-provenance';

export type ReviewField = 'company' | 'names' | 'address' | 'projectName' | 'country';

export type ProposalValue = string | string[] | { firstName: string; lastName: string };

export interface FieldProposal {
  ref: string;
  projectLabel: string;
  value: ProposalValue;
  review?: AddressReview;
}

export type DirectoryProposals = Partial<Record<ReviewField, FieldProposal>>;

export const REVIEW_FIELDS: ReviewField[] = ['company', 'names', 'address', 'projectName', 'country'];

export const FIELD_KEYS: Record<ReviewField, (keyof PrefillTarget)[]> = {
  company: ['clientCompanyName'],
  names: ['clientFirstName', 'clientSurname'],
  address: ['clientAddressLines'],
  projectName: ['projectName'],
  country: ['projectCountry'],
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A field's value in a form or an `applied` record, in the shape a proposal uses. */
export function fieldValue(field: ReviewField, target: Partial<PrefillTarget>): ProposalValue | undefined {
  if (field === 'names') {
    if (target.clientFirstName === undefined && target.clientSurname === undefined) return undefined;
    return { firstName: target.clientFirstName ?? '', lastName: target.clientSurname ?? '' };
  }
  return target[FIELD_KEYS[field][0]];
}

function offered(field: { value: unknown; status: string } | undefined): unknown {
  return field && (field.status === 'from_synergy' || field.status === 'needs_review') ? field.value : null;
}

/** What this prefill would put in the field, padded like the shared merge does, or null. */
export function incomingValue(field: ReviewField, prefill: FeeProposalPrefill, width: number): ProposalValue | null {
  const f = prefill.fields;
  switch (field) {
    case 'company':
    case 'projectName': {
      const value = offered(field === 'company' ? f.clientCompanyName : f.projectName);
      return typeof value === 'string' && value.trim() ? value : null;
    }
    case 'country': {
      const value = offered(f.projectCountry);
      return value === 'EW' || value === 'J' || value === 'OTHER' ? value : null;
    }
    case 'address': {
      const value = offered(f.clientAddressLines);
      if (!Array.isArray(value) || !value.length) return null;
      const lines = value as string[];
      return [...lines, ...Array<string>(Math.max(0, width - lines.length)).fill('')];
    }
    case 'names': {
      const first = offered(f.clientFirstName);
      const last = offered(f.clientSurname);
      if (typeof first !== 'string' && typeof last !== 'string') return null;
      return { firstName: typeof first === 'string' ? first : '', lastName: typeof last === 'string' ? last : '' };
    }
  }
}

/**
 * Proposals after a merge. A field gets one only if the user owns it now, the project offers a
 * value, that value differs from the field and from what was last filled there (so an edit is not
 * re-questioned), and the user has not already kept their own against this exact value.
 */
export function proposalsFor(args: {
  prefill: FeeProposalPrefill;
  values: PrefillTarget;
  kept: (keyof PrefillTarget)[];
  previouslyApplied: Partial<PrefillTarget>;
  existing: DirectoryProposals;
  declined: Partial<Record<ReviewField, string>>;
  width: number;
}): DirectoryProposals {
  const next: DirectoryProposals = { ...args.existing };
  for (const field of REVIEW_FIELDS) {
    const incoming = incomingValue(field, args.prefill, args.width);
    const owned = FIELD_KEYS[field].some((key) => args.kept.includes(key));
    if (
      !owned ||
      incoming === null ||
      same(incoming, fieldValue(field, args.values)) ||
      same(incoming, fieldValue(field, args.previouslyApplied)) ||
      args.declined[field] === JSON.stringify(incoming)
    ) {
      delete next[field];
      continue;
    }
    const review =
      field === 'address' && args.prefill.fields.clientAddressLines.status === 'needs_review'
        ? (args.prefill.fields.clientAddressLines.review ?? [])
        : undefined;
    next[field] = { ref: args.prefill.project.id, projectLabel: args.prefill.project.label, value: incoming, ...(review ? { review } : {}) };
  }
  return next;
}
