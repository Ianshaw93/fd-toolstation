'use client';

import { Dispatch } from 'react';
import type { ServiceConfig } from '../../lib/fee-types';
import { MONTHS, YEARS, SERVICES_WITH_MODELS, SERVICES_WITH_EXTENDED_TRAVEL, SERVICES_WITH_HOURS } from '../../lib/fee-constants';

interface Props {
  serviceKey: string;
  label: string;
  config: ServiceConfig;
  dispatchType: string;
  toggleType: string;
  dispatch: Dispatch<any>;
}

export default function ServiceRow({ serviceKey, label, config, dispatchType, toggleType, dispatch }: Props) {
  const hasModels = SERVICES_WITH_MODELS.has(serviceKey);
  const hasExtendedTravel = SERVICES_WITH_EXTENDED_TRAVEL.has(serviceKey);
  const hasHours = SERVICES_WITH_HOURS.has(serviceKey);

  const setField = (field: keyof ServiceConfig, value: any) => {
    dispatch({ type: dispatchType, key: serviceKey, field, value });
  };

  return (
    <tr className={`border-b border-gray-100 ${config.included ? 'bg-blue-50/30' : ''}`}>
      <td className="py-2 pr-3">
        <span className="text-sm text-gray-700">{label}</span>
      </td>
      <td className="py-2 px-2 text-center">
        <input
          type="checkbox"
          checked={config.included}
          onChange={() => dispatch({ type: toggleType, key: serviceKey })}
          className="w-4 h-4 rounded"
        />
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          value={config.included ? config.fee || '' : ''}
          onChange={(e) => setField('fee', parseFloat(e.target.value) || 0)}
          disabled={!config.included}
          placeholder="0"
          className="w-24 px-2 py-1.5 text-sm rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
        />
      </td>
      <td className="py-2 px-2 text-center">
        <input
          type="checkbox"
          checked={config.optional}
          onChange={(e) => setField('optional', e.target.checked)}
          disabled={!config.included}
          className="w-4 h-4 rounded disabled:opacity-40"
        />
      </td>
      {hasHours ? (
        <>
          <td className="py-2 px-2">
            <input
              type="number"
              value={config.included ? config.hours_per_month || '' : ''}
              onChange={(e) => setField('hours_per_month', parseInt(e.target.value) || null)}
              disabled={!config.included}
              placeholder="Hrs/mo"
              className="w-20 px-2 py-1.5 text-sm rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </td>
          <td className="py-2 px-2">
            <input
              type="number"
              value={config.included ? config.meetings_per_month || '' : ''}
              onChange={(e) => setField('meetings_per_month', parseInt(e.target.value) || null)}
              disabled={!config.included}
              placeholder="Mtgs/mo"
              className="w-20 px-2 py-1.5 text-sm rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </td>
        </>
      ) : (
        <>
          <td className="py-2 px-2 text-center">
            <input
              type="checkbox"
              checked={config.limit_meetings}
              onChange={(e) => setField('limit_meetings', e.target.checked)}
              disabled={!config.included}
              className="w-4 h-4 rounded disabled:opacity-40"
            />
          </td>
          <td className="py-2 px-2">
            <input
              type="number"
              value={config.limit_meetings ? config.meeting_number || '' : ''}
              onChange={(e) => setField('meeting_number', parseInt(e.target.value) || null)}
              disabled={!config.included || !config.limit_meetings}
              placeholder="#"
              className="w-16 px-2 py-1.5 text-sm rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </td>
        </>
      )}
      <td className="py-2 px-2">
        <div className="flex gap-1">
          <select
            value={config.end_date_month || ''}
            onChange={(e) => setField('end_date_month', e.target.value || null)}
            disabled={!config.included}
            className="w-28 px-1 py-1.5 text-sm rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">Month</option>
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={config.end_date_year || ''}
            onChange={(e) => setField('end_date_year', e.target.value || null)}
            disabled={!config.included}
            className="w-20 px-1 py-1.5 text-sm rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">Year</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </td>
      {hasModels && (
        <td className="py-2 px-2">
          <input
            type="number"
            value={config.included ? config.num_models || '' : ''}
            onChange={(e) => setField('num_models', parseInt(e.target.value) || null)}
            disabled={!config.included}
            placeholder="#"
            className="w-16 px-2 py-1.5 text-sm rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </td>
      )}
      {hasExtendedTravel && (
        <td className="py-2 px-2 text-center">
          <input
            type="checkbox"
            checked={config.extended_travel_distance}
            onChange={(e) => setField('extended_travel_distance', e.target.checked)}
            disabled={!config.included}
            className="w-4 h-4 rounded disabled:opacity-40"
          />
        </td>
      )}
    </tr>
  );
}
