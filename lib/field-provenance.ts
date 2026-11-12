// Where each autofilled value in the Word fee pane came from, for the per-field badges.
// A value counts as filled only while it still equals what was put there; once the user changes
// it the field reads "edited" and keeps where it came from. Fields never filled have no badge.

import type { FeeProposalSnapshot } from '../hooks/useFeeProposal';

export type FillSource = 'synergy' | 'microsoft' | 'contact';
export type AddressReview = Array<'hasAddress_false' | 'home_slot_on_company_record'>;

export type Provenance =
  | { kind: 'synergy'; review?: AddressReview }
  | { kind: 'microsoft' }
  | { kind: 'contact' }
  | { kind: 'edited'; was: FillSource }
  /** The user's own value, kept from an earlier project; it is not from the linked one. */
  | { kind: 'carried'; from: string };

export interface FieldProvenance {
  company: Provenance | null;
  names: Provenance | null;
  address: Provenance | null;
  projectName: Provenance | null;
  country: Provenance | null;
  engineer: Provenance | null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function fromSynergy(current: unknown, applied: unknown): Provenance | null {
  if (applied === undefined) return null;
  return same(current, applied) ? { kind: 'synergy' } : { kind: 'edited', was: 'synergy' };
}

export function fieldProvenance(state: FeeProposalSnapshot): FieldProvenance {
  const applied = state.directory_applied;
  const { client, project } = state;

  let address = fromSynergy(client.address_lines, applied.clientAddressLines);
  if (address?.kind === 'synergy' && state.directory_review.length) address = { kind: 'synergy', review: state.directory_review };

  let names: Provenance | null = null;
  const pick = state.client_contact_pick;
  if (pick) {
    names = client.first_name === pick.firstName && client.surname === pick.lastName ? { kind: 'contact' } : { kind: 'edited', was: 'contact' };
  } else if (applied.clientFirstName !== undefined || applied.clientSurname !== undefined) {
    const unchanged =
      (applied.clientFirstName === undefined || applied.clientFirstName === client.first_name) &&
      (applied.clientSurname === undefined || applied.clientSurname === client.surname);
    names = unchanged ? { kind: 'synergy' } : { kind: 'edited', was: 'synergy' };
  }

  let engineer: Provenance | null = null;
  if (state.engineer_source === 'account') engineer = { kind: 'microsoft' };
  else if (state.engineer_source === 'user' && state.engineer_was_auto) engineer = { kind: 'edited', was: 'microsoft' };

  const carried = (field: keyof typeof state.carried_from, otherwise: Provenance | null): Provenance | null => {
    const from = state.carried_from[field];
    return from ? { kind: 'carried', from } : otherwise;
  };
  return {
    company: carried('company', fromSynergy(client.company_name ?? '', applied.clientCompanyName)),
    names: carried('names', names),
    address: carried('address', address),
    projectName: carried('projectName', fromSynergy(project.project_name, applied.projectName)),
    country: carried('country', fromSynergy(project.country, applied.projectCountry)),
    engineer,
  };
}

/** One polite sentence per source, for a live region. Same fields, same words, so no re-announce. */
export function provenanceAnnouncement(p: FieldProvenance): string {
  const synergy: string[] = [];
  if (p.company?.kind === 'synergy') synergy.push('company');
  if (p.names?.kind === 'synergy') synergy.push('client name');
  if (p.address?.kind === 'synergy') synergy.push(p.address.review?.length ? 'address (check it)' : 'address');
  if (p.projectName?.kind === 'synergy') synergy.push('project name');
  if (p.country?.kind === 'synergy') synergy.push('project country');
  const sentences: string[] = [];
  if (synergy.length) sentences.push(`Filled from Total Synergy: ${synergy.join(', ')}.`);
  if (p.engineer?.kind === 'microsoft') sentences.push('Engineer filled from your Microsoft sign-in.');
  return sentences.join(' ');
}

export function addressReviewText(review: AddressReview): string {
  const why: string[] = [];
  if (review.includes('home_slot_on_company_record')) why.push('Synergy holds this in the company record’s home address slot');
  if (review.includes('hasAddress_false')) why.push(why.length ? 'marks it as not a full address' : 'Synergy marks it as not a full address');
  return `${why.join(' and ') || 'Synergy flagged this address'}. Check it before sending.`;
}
