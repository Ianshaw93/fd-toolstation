'use client';

import { useState } from 'react';

import NumberField from './NumberField';
import { FIRE_GROWTH_RATES } from '../../lib/smoke-layer-types';
import type { SmokeLayerFormState } from '../../lib/smoke-layer-form';

interface RoomFireSectionProps {
  form: SmokeLayerFormState;
  onChange: (field: keyof SmokeLayerFormState, value: string) => void;
  invalid: Set<keyof SmokeLayerFormState>;
}

const selectClass =
  'w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';

export default function RoomFireSection({ form, onChange, invalid }: RoomFireSectionProps) {
  const matchedGrowthRate = FIRE_GROWTH_RATES.find((r) => String(r.value) === form.fgr);
  // Choosing "Custom" has to stick even while the value still equals a standard
  // rate, otherwise the dropdown would snap straight back and the coefficient
  // field could never be reached.
  const [customGrowthRate, setCustomGrowthRate] = useState(!matchedGrowthRate);
  const showCustomGrowthRate = customGrowthRate || !matchedGrowthRate;

  const area = Number(form.roomArea);
  const racking = Number(form.rackingPerc);
  const smokeArea =
    Number.isFinite(area) && Number.isFinite(racking) && form.roomArea !== '' && racking < 100
      ? area * (1 - racking / 100)
      : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumberField
        label="Floor area"
        unit="m²"
        value={form.roomArea}
        onChange={(v) => onChange('roomArea', v)}
        invalid={invalid.has('roomArea')}
        min="0"
      />
      <NumberField
        label="Room height"
        unit="m"
        value={form.roomHeight}
        onChange={(v) => onChange('roomHeight', v)}
        invalid={invalid.has('roomHeight')}
        hint="Average clear height to the underside of the roof."
        min="0"
        step="0.1"
      />
      <NumberField
        label="Racking"
        unit="% of volume"
        value={form.rackingPerc}
        onChange={(v) => onChange('rackingPerc', v)}
        invalid={invalid.has('rackingPerc')}
        hint={
          smokeArea === null
            ? 'Use 50% as standard. Racking displaces volume, reducing the area the smoke fills.'
            : `Smoke fills ${smokeArea.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m² of plan area.`
        }
        min="0"
        max="99"
        step="1"
      />

      <div>
        <label htmlFor="growth-rate" className="block text-sm font-medium text-gray-700 mb-1">
          Fire growth rate
        </label>
        <select
          id="growth-rate"
          value={showCustomGrowthRate ? 'custom' : String(matchedGrowthRate!.value)}
          onChange={(e) => {
            setCustomGrowthRate(e.target.value === 'custom');
            if (e.target.value !== 'custom') onChange('fgr', e.target.value);
          }}
          className={selectClass}
        >
          {FIRE_GROWTH_RATES.map((r) => (
            <option key={r.label} value={String(r.value)}>
              {r.label} ({r.value} kW/s²)
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        {showCustomGrowthRate && (
          <div className="mt-2">
            <NumberField
              label="Growth rate coefficient"
              unit="kW/s²"
              value={form.fgr}
              onChange={(v) => onChange('fgr', v)}
              invalid={invalid.has('fgr')}
              step="0.001"
              min="0"
            />
          </div>
        )}
        {!showCustomGrowthRate && (
          <p className="text-xs text-gray-500 mt-1">
            t-squared growth, Q = {matchedGrowthRate!.value}t². 70% of the heat release is taken as
            convective.
          </p>
        )}
      </div>
    </div>
  );
}
