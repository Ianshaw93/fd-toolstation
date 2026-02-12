'use client';

import { Dispatch } from 'react';
import type { DesignStagesRiba1to4 } from '../../lib/fee-types';
import { SERVICE_LABELS_1_4, SERVICES_WITH_MODELS, SERVICES_WITH_EXTENDED_TRAVEL } from '../../lib/fee-constants';
import ServiceRow from './ServiceRow';

interface Props {
  stages: DesignStagesRiba1to4;
  dispatch: Dispatch<any>;
}

const SERVICE_KEYS = Object.keys(SERVICE_LABELS_1_4) as (keyof DesignStagesRiba1to4)[];

export default function DesignStagesSection({ stages, dispatch }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 pr-3 text-xs font-medium text-gray-500 uppercase">Service</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase text-center">Included</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">Fee (£)</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase text-center">Optional</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase text-center">Limit Mtgs</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">Mtg #</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">End Date</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">Models</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase text-center">Ext. Travel</th>
          </tr>
        </thead>
        <tbody>
          {SERVICE_KEYS.map((key) => (
            <ServiceRow
              key={key}
              serviceKey={key}
              label={SERVICE_LABELS_1_4[key]}
              config={stages[key]}
              dispatchType="SET_SERVICE_1_4"
              toggleType="TOGGLE_SERVICE_1_4"
              dispatch={dispatch}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
