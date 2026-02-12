'use client';

import { Dispatch } from 'react';
import type { ClientDetails } from '../../lib/fee-types';

interface Props {
  client: ClientDetails;
  dispatch: Dispatch<any>;
}

export default function ClientDetailsSection({ client, dispatch }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
        <input
          type="text"
          value={client.first_name}
          onChange={(e) => dispatch({ type: 'SET_CLIENT', field: 'first_name', value: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
        <input
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
