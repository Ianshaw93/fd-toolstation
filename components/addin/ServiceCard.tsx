'use client';

import { Dispatch } from 'react';
import type { ServiceConfig } from '../../lib/fee-types';
import { MONTHS, YEARS, SERVICES_WITH_MODELS, SERVICES_WITH_EXTENDED_TRAVEL, SERVICES_WITH_HOURS } from '../../lib/fee-constants';

// One service as a stacked card for the 320 px task pane: tick, name and fee on
// one line, and the service's options underneath only once it is included. Same
// reducer actions as the web tool's ServiceRow, so the two stay interchangeable.

interface Props {
  serviceKey: string;
  label: string;
  config: ServiceConfig;
  dispatchType: string;
  toggleType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: Dispatch<any>;
  onToggle?: () => void;
}

const input =
  'px-2 py-1 text-sm rounded-md bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400';

export default function ServiceCard({ serviceKey, label, config, dispatchType, toggleType, dispatch, onToggle }: Props) {
  const hasModels = SERVICES_WITH_MODELS.has(serviceKey);
  const hasExtendedTravel = SERVICES_WITH_EXTENDED_TRAVEL.has(serviceKey);
  const hasHours = SERVICES_WITH_HOURS.has(serviceKey);
  const id = `svc-${serviceKey}`;

  const setField = (field: keyof ServiceConfig, value: boolean | number | string | null) =>
    dispatch({ type: dispatchType, key: serviceKey, field, value });

  return (
    <div className={`rounded-lg border ${config.included ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200'}`}>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 py-1.5">
        <input
          id={id}
          type="checkbox"
          checked={config.included}
          onChange={() => (onToggle ? onToggle() : dispatch({ type: toggleType, key: serviceKey }))}
          className="w-4 h-4 rounded"
        />
        <label htmlFor={id} className="text-sm text-gray-800 leading-tight">
          {label}
        </label>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          £
          <input
            type="number"
            value={config.included ? config.fee || '' : ''}
            onChange={(e) => setField('fee', parseFloat(e.target.value) || 0)}
            disabled={!config.included}
            placeholder="0"
            aria-label={`${label} fee`}
            className={`${input} w-20 text-right tabular-nums`}
          />
        </span>
      </div>

      {config.included && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-2 pb-2 pl-8 text-xs text-gray-600">
          <label className="flex items-center gap-1.5 text-gray-800">
            <input
              type="checkbox"
              checked={config.optional}
              onChange={(e) => setField('optional', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Optional
          </label>

          {hasHours ? (
            <>
              <label className="grid gap-0.5">
                Hours / month
                <input
                  type="number"
                  value={config.hours_per_month || ''}
                  onChange={(e) => setField('hours_per_month', parseInt(e.target.value) || null)}
                  placeholder="0"
                  className={`${input} w-full`}
                />
              </label>
              <label className="grid gap-0.5">
                Meetings / month
                <input
                  type="number"
                  value={config.meetings_per_month || ''}
                  onChange={(e) => setField('meetings_per_month', parseInt(e.target.value) || null)}
                  placeholder="0"
                  className={`${input} w-full`}
                />
              </label>
            </>
          ) : (
            <label className="col-span-2 flex items-center gap-1.5 whitespace-nowrap text-gray-800">
              <input
                type="checkbox"
                checked={config.limit_meetings}
                onChange={(e) => setField('limit_meetings', e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Limit meetings
              <input
                type="number"
                value={config.limit_meetings ? config.meeting_number || '' : ''}
                onChange={(e) => setField('meeting_number', parseInt(e.target.value) || null)}
                disabled={!config.limit_meetings}
                placeholder="#"
                aria-label={`${label} meeting limit`}
                className={`${input} w-12`}
              />
            </label>
          )}

          <div className="col-span-2 grid gap-0.5">
            End date
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={config.end_date_month || ''}
                onChange={(e) => setField('end_date_month', e.target.value || null)}
                aria-label={`${label} end month`}
                className={`${input} px-1`}
              >
                <option value="">Month</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={config.end_date_year || ''}
                onChange={(e) => setField('end_date_year', e.target.value || null)}
                aria-label={`${label} end year`}
                className={`${input} px-1`}
              >
                <option value="">Year</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {hasModels && (
            <label className="grid gap-0.5">
              Models
              <input
                type="number"
                value={config.num_models || ''}
                onChange={(e) => setField('num_models', parseInt(e.target.value) || null)}
                placeholder="#"
                className={`${input} w-16`}
              />
            </label>
          )}
          {hasExtendedTravel && (
            <label className="flex items-center gap-1.5 self-end text-gray-800">
              <input
                type="checkbox"
                checked={config.extended_travel_distance}
                onChange={(e) => setField('extended_travel_distance', e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Extended travel
            </label>
          )}
        </div>
      )}
    </div>
  );
}
