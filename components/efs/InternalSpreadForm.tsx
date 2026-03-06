'use client';

import { INTERNAL_SPREAD_ELEMENTS } from '../../lib/efs-types';
import type { InternalSpreadData } from '../../lib/efs-types';

const FIRE_RESISTANCE_PERIODS = [30, 60, 90, 120];

interface InternalSpreadFormProps {
  data: InternalSpreadData;
  onChange: (data: InternalSpreadData) => void;
}

export function createInitialInternalSpreadData(): InternalSpreadData {
  const elementsPresent: Record<string, boolean> = {};
  for (const el of INTERNAL_SPREAD_ELEMENTS) {
    elementsPresent[el] = false;
  }
  return {
    fireSeparationRequired: true,
    fireSeparationPeriod: 60,
    useStructuralFireEngineering: false,
    elementsPresent,
  };
}

export default function InternalSpreadForm({ data, onChange }: InternalSpreadFormProps) {
  const handleTopChange = (field: keyof Omit<InternalSpreadData, 'elementsPresent'>, value: boolean | number) => {
    onChange({ ...data, [field]: value });
  };

  const handleElementChange = (element: string, present: boolean) => {
    onChange({
      ...data,
      elementsPresent: { ...data.elementsPresent, [element]: present },
    });
  };

  const inputClass = "px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent";

  return (
    <div className="space-y-6">
      {/* Top section - fire separation settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-medium text-gray-700 flex-1">
            Is Fire Separation Required between Uses?
          </label>
          <select
            value={data.fireSeparationRequired ? 'Yes' : 'No'}
            onChange={(e) => handleTopChange('fireSeparationRequired', e.target.value === 'Yes')}
            className={`${inputClass} w-24 text-center`}
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>

        {data.fireSeparationRequired && (
          <div className="flex items-center justify-between gap-4 pl-4 border-l-2 border-gray-200">
            <label className="text-sm text-gray-600 flex-1">
              To what period of fire resistance? (minutes)
            </label>
            <select
              value={data.fireSeparationPeriod}
              onChange={(e) => handleTopChange('fireSeparationPeriod', parseInt(e.target.value))}
              className={`${inputClass} w-24 text-center`}
            >
              {FIRE_RESISTANCE_PERIODS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-medium text-gray-700 flex-1">
            Will structural fire engineering be used to remove passive fire protection?
          </label>
          <select
            value={data.useStructuralFireEngineering ? 'Yes' : 'No'}
            onChange={(e) => handleTopChange('useStructuralFireEngineering', e.target.value === 'Yes')}
            className={`${inputClass} w-24 text-center`}
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
      </div>

      {/* Elements present table */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">
          Select &apos;Yes&apos; for elements present inside the building:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 pr-4 font-medium text-gray-700">Element</th>
                <th className="text-center py-3 px-2 font-medium text-gray-700 w-24">Present?</th>
              </tr>
            </thead>
            <tbody>
              {INTERNAL_SPREAD_ELEMENTS.map((element) => (
                <tr key={element} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-600">{element}</td>
                  <td className="py-2 px-2">
                    <select
                      value={data.elementsPresent[element] ? 'Yes' : 'No'}
                      onChange={(e) => handleElementChange(element, e.target.value === 'Yes')}
                      className={`${inputClass} w-full text-center`}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
