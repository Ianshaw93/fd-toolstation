// People at the Client company for the name tags: client.companyContacts / client.contactSuggestions
// from the directory (contract at c120cec). Suggestions count only once the company lookup is done,
// and only those of the found Client company marked as Total Synergy company contacts. They are
// not project contacts and are never chosen automatically.

import type { ContactSuggestion, FeeProposalPrefill } from './vendor/fd-directory-client';

export type CompanyContactsLookup = FeeProposalPrefill['client']['companyContacts']['lookup'];

export interface ContactSuggestions {
  companyName: string | null;
  lookup: CompanyContactsLookup;
  errorCode: string | null;
  truncated: boolean;
  people: ContactSuggestion[];
}

export const NO_CONTACT_SUGGESTIONS: ContactSuggestions = {
  companyName: null,
  lookup: 'not_applicable',
  errorCode: null,
  truncated: false,
  people: [],
};

export function readContactSuggestions(prefill: FeeProposalPrefill): ContactSuggestions {
  const { client } = prefill;
  const contacts = client.companyContacts;
  const base = {
    companyName: client.displayName ?? null,
    lookup: contacts?.lookup ?? 'not_applicable',
    errorCode: contacts?.errorCode ?? null,
    truncated: contacts?.truncated === true,
  };
  if (!contacts || contacts.lookup !== 'done' || client.status !== 'found' || client.contactId === null) {
    return { ...base, people: [] };
  }
  const people = (client.contactSuggestions ?? []).filter(
    (person) =>
      person.companyId === client.contactId &&
      person.isActive === true &&
      person.source === 'total-synergy' &&
      person.association === 'company',
  );
  return { ...base, people };
}

/** Whether the directory is still fetching the company's people, so the pane should ask again. */
export function companyContactsPending(prefill: FeeProposalPrefill): boolean {
  return prefill.client.status === 'found' && prefill.client.companyContacts?.lookup === 'pending';
}
