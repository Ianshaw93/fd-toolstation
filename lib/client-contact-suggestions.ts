// Name tags for the Client company's people. Reads the PROPOSED additive field
// client.contactSuggestions on the directory's fee-proposal-prefill (not yet in contractVersion 1;
// the directory fills it from Synergy Contacts/Index criteria.parentContactId = the Client company).
// Only active company people of the found Client company are offered, and only their names are
// kept. Keep this the single place to change when the directory publishes the final shape.

import type { FeeProposalPrefill } from './vendor/fd-directory-client';

export interface ContactSuggestion {
  id: number;
  displayName: string;
  firstName: string;
  lastName: string;
}

export interface ContactSuggestions {
  companyName: string | null;
  people: ContactSuggestion[];
}

export const NO_CONTACT_SUGGESTIONS: ContactSuggestions = { companyName: null, people: [] };

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function readContactSuggestions(prefill: FeeProposalPrefill): ContactSuggestions {
  const { client } = prefill;
  const companyName = client.displayName ?? null;
  const raw = (client as unknown as { contactSuggestions?: unknown }).contactSuggestions;
  if (client.lookup !== 'done' || client.status !== 'found' || client.contactId === null || !Array.isArray(raw)) {
    return { companyName, people: [] };
  }
  const people: ContactSuggestion[] = [];
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'number' || r.companyId !== client.contactId) continue;
    if (r.isActive !== true || r.source !== 'total-synergy' || r.association !== 'company') continue;
    const firstName = text(r.firstName);
    const lastName = text(r.lastName);
    if (!firstName && !lastName) continue;
    const displayName = text(r.displayName) || [firstName, lastName].filter(Boolean).join(' ');
    people.push({ id: r.id, displayName, firstName, lastName });
  }
  return { companyName, people };
}
