'use client';

import type { BuildingOverview } from '../../lib/efs-types';

interface BuildingOverviewSectionProps {
  data: BuildingOverview;
  onChange: (field: keyof BuildingOverview, value: string | boolean) => void;
}

const SUPPRESSION_STANDARDS = ['BS EN 12845', 'Other'];
const FIRE_ALARM_CATEGORIES = ['L1', 'L2', 'L3', 'L4', 'M'];

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';

export default function BuildingOverviewSection({ data, onChange }: BuildingOverviewSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Has Suppression</label>
        <select
          value={data.hasSuppression ? 'Yes' : 'No'}
          onChange={(e) => onChange('hasSuppression', e.target.value === 'Yes')}
          className={inputClass}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Suppression Standard</label>
        <select
          value={data.suppressionStandard}
          onChange={(e) => onChange('suppressionStandard', e.target.value)}
          className={inputClass}
        >
          {SUPPRESSION_STANDARDS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fire Alarm &amp; Detection Category</label>
        <select
          value={data.fireAlarmCategory}
          onChange={(e) => onChange('fireAlarmCategory', e.target.value)}
          className={inputClass}
        >
          {FIRE_ALARM_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Investigation Period</label>
        <select
          value={data.investigationPeriod ? 'Yes' : 'No'}
          onChange={(e) => onChange('investigationPeriod', e.target.value === 'Yes')}
          className={inputClass}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Required Fire Resistance (mins)</label>
        <input
          type="number"
          value={data.requiredFireResistance}
          onChange={(e) => onChange('requiredFireResistance', e.target.value)}
          className={inputClass}
        />
      </div>
    </div>
  );
}
