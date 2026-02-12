'use client';

import { Dispatch } from 'react';
import type { FeeOptions, Engineer } from '../../lib/fee-types';

interface Props {
  feeOptions: FeeOptions;
  engineers: Engineer[];
  dispatch: Dispatch<any>;
}

export default function FeeOptionsSection({ feeOptions, engineers, dispatch }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Engineer Name</label>
        <select
          value={feeOptions.engineer_name}
          onChange={(e) => dispatch({ type: 'SET_FEE_OPTIONS', field: 'engineer_name', value: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        >
          <option value="">Select Engineer</option>
          {engineers.map((eng) => (
            <option key={eng.full_name} value={eng.full_name}>
              {eng.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">PII Limit (£)</label>
        <input
          type="number"
          value={feeOptions.pii_limit}
          onChange={(e) => dispatch({ type: 'SET_FEE_OPTIONS', field: 'pii_limit', value: parseInt(e.target.value) || 0 })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
      </div>
      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={feeOptions.include_hourly_rates}
            onChange={(e) => dispatch({ type: 'SET_FEE_OPTIONS', field: 'include_hourly_rates', value: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-gray-700">Include Hourly Rates</span>
        </label>
      </div>
    </div>
  );
}
