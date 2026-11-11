'use client';

import { Dispatch, useId } from 'react';
import type { ContactSuggestions } from '../../lib/client-contact-suggestions';
import { addressReviewText, type FieldProvenance } from '../../lib/field-provenance';
import type { DirectoryProposals } from '../../lib/directory-proposals';
import FieldProposalReview from './FieldProposalReview';
import SourceBadge from './SourceBadge';
import type { ClientDetails } from '../../lib/fee-types';

interface Props {
  client: ClientDetails;
  dispatch: Dispatch<any>;
  /** Word task pane only. The web form leaves this off. */
  showCompany?: boolean;
  /** Word task pane only: the Client company's people, picked by click into first name / surname. */
  contactSuggestions?: ContactSuggestions;
  /** Word task pane only: where autofilled values came from. */
  provenance?: Pick<FieldProvenance, 'company' | 'names' | 'address'>;
  /** Word task pane only: project values offered for fields the user owns. */
  proposals?: DirectoryProposals;
}

export default function ClientDetailsSection({ client, dispatch, showCompany = false, contactSuggestions, provenance, proposals }: Props) {
  const addressReview = provenance?.address?.kind === 'synergy' ? provenance.address.review : undefined;
  const id = useId();
  const people = contactSuggestions?.people ?? [];
  const company = contactSuggestions?.companyName ?? 'the client company';
  const groupLabel = `Total Synergy contacts at ${company}`;
  let contactsStatus: string | null = null;
  if (contactSuggestions?.lookup === 'pending') contactsStatus = `Looking up people at ${company}. You can type a name meanwhile.`;
  else if (contactSuggestions?.lookup === 'failed') {
    contactsStatus = `People at ${company} could not be loaded${contactSuggestions.errorCode ? ` (${contactSuggestions.errorCode})` : ''}. Type a name.`;
  } else if (contactSuggestions?.lookup === 'done' && contactSuggestions.truncated) {
    contactsStatus = 'Not everyone at the company is listed. Type a name if yours is missing.';
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {showCompany && (
        <div className="md:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <label htmlFor={`${id}-company`} className="block text-sm font-medium text-gray-700">Company</label>
            <SourceBadge provenance={provenance?.company} testId="source-company" />
          </div>
          <input
            id={`${id}-company`}
            type="text"
            value={client.company_name ?? ''}
            onChange={(e) => dispatch({ type: 'SET_CLIENT', field: 'company_name', value: e.target.value })}
            className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          />
          <FieldProposalReview field="company" proposal={proposals?.company} dispatch={dispatch} />
          <p className="mt-1 text-xs text-gray-500">
            The letter says Dear {'{first name}'}. The company is not that name.
          </p>
        </div>
      )}
      {contactsStatus && (
        <p data-testid="company-contacts-status" role="status" className="md:col-span-2 text-xs text-gray-600">
          {contactsStatus}
        </p>
      )}
      {people.length > 0 && (
        <div className="md:col-span-2">
          <p id={`${id}-people`} className="text-xs font-medium text-gray-700 mb-1">{groupLabel}</p>
          <div role="group" aria-labelledby={`${id}-people`} className="flex flex-wrap gap-1.5">
            {people.map((person) => {
              const selected = client.first_name === (person.firstName ?? '') && client.surname === (person.lastName ?? '');
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => dispatch({ type: 'PICK_CLIENT_CONTACT', contactId: person.id })}
                  className={`px-2.5 py-1 rounded-full border text-xs focus:outline-none focus:ring-2 focus:ring-gray-400 ${
                    selected ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {person.displayName}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-gray-500">People at the client company in Total Synergy, not project contacts. Pick one or type a name.</p>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label htmlFor={`${id}-first`} className="block text-sm font-medium text-gray-700">First Name</label>
          <SourceBadge provenance={provenance?.names} testId="source-names" />
        </div>
        <input
          id={`${id}-first`}
          type="text"
          value={client.first_name}
          onChange={(e) => dispatch({ type: 'SET_CLIENT', field: 'first_name', value: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
      </div>
      <div>
        <label htmlFor={`${id}-surname`} className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
        <input
          id={`${id}-surname`}
          type="text"
          value={client.surname}
          onChange={(e) => dispatch({ type: 'SET_CLIENT', field: 'surname', value: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
      </div>
      <div className="md:col-span-2 -mt-2">
        <FieldProposalReview field="names" proposal={proposals?.names} dispatch={dispatch} />
      </div>
      <div className="md:col-span-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="block text-sm font-medium text-gray-700">Address</span>
          <SourceBadge provenance={provenance?.address} testId="source-address" />
        </div>
        {addressReview?.length ? (
          <p data-testid="address-review" className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
            {addressReviewText(addressReview)}
          </p>
        ) : null}
        <div className="space-y-2">
          {client.address_lines.map((line, i) => (
            <input
              key={i}
              type="text"
              value={line}
              placeholder={i === 0 ? 'Address line 1' : `Address line ${i + 1} (optional)`}
              onChange={(e) => {
                const newLines = [...client.address_lines];
                newLines[i] = e.target.value;
                dispatch({ type: 'SET_CLIENT', field: 'address_lines', value: newLines });
              }}
              className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          ))}
        </div>
        <FieldProposalReview field="address" proposal={proposals?.address} dispatch={dispatch} />
      </div>
    </div>
  );
}
