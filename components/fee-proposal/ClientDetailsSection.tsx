'use client';

import { Dispatch, useId } from 'react';
import type { ContactSuggestions } from '../../lib/client-contact-suggestions';
import type { ClientDetails } from '../../lib/fee-types';

interface Props {
  client: ClientDetails;
  dispatch: Dispatch<any>;
  /** Word task pane only. The web form leaves this off. */
  showCompany?: boolean;
  /** Word task pane only: the Client company's people, picked by click into first name / surname. */
  contactSuggestions?: ContactSuggestions;
}

export default function ClientDetailsSection({ client, dispatch, showCompany = false, contactSuggestions }: Props) {
  const id = useId();
  const people = contactSuggestions?.people ?? [];
  const groupLabel = `${contactSuggestions?.companyName ?? 'Client company'} company contacts`;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {showCompany && (
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
          <input
            type="text"
            value={client.company_name ?? ''}
            onChange={(e) => dispatch({ type: 'SET_CLIENT', field: 'company_name', value: e.target.value })}
            className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            The letter says Dear {'{first name}'}. The company is not that name.
          </p>
        </div>
      )}
      {people.length > 0 && (
        <div className="md:col-span-2">
          <p id={`${id}-people`} className="text-xs font-medium text-gray-700 mb-1">{groupLabel}</p>
          <div role="group" aria-labelledby={`${id}-people`} className="flex flex-wrap gap-1.5">
            {people.map((person) => {
              const selected = client.first_name === person.firstName && client.surname === person.lastName;
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
          <p className="mt-1 text-xs text-gray-500">People at the company in Synergy, not project contacts. Pick one or type a name.</p>
        </div>
      )}
      <div>
        <label htmlFor={`${id}-first`} className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
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
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
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
      </div>
    </div>
  );
}
