'use client';

import { useState } from 'react';

import NumberField from './NumberField';
import { FIRE_GROWTH_RATES } from '../../lib/smoke-layer-types';
import type { SharedField, SharedForm } from '../../lib/smoke-layer-project';

interface SharedAssumptionsSectionProps {
  shared: SharedForm;
  onChange: (field: SharedField, value: string) => void;
  invalid: Set<SharedField>;
}

const selectClass =
  'w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';

/**
 * Assumptions shared by every building in the assessment. The report quotes
 * these once ("the same parameters are used for all of the units").
 */
export default function SharedAssumptionsSection({ shared, onChange, invalid }: SharedAssumptionsSectionProps) {
  const matchedGrowthRate = FIRE_GROWTH_RATES.find((r) => String(r.value) === shared.fgr);
  // Choosing "Custom" has to stick even while the value still equals a standard
  // rate, otherwise the dropdown would snap straight back and the coefficient
  // field could never be reached.
  const [customGrowthRate, setCustomGrowthRate] = useState(!matchedGrowthRate);
  const showCustomGrowthRate = customGrowthRate || !matchedGrowthRate;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
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
        {showCustomGrowthRate ? (
          <div className="mt-2">
            <NumberField
              label="Growth rate coefficient"
              unit="kW/s²"
              value={shared.fgr}
              onChange={(v) => onChange('fgr', v)}
              invalid={invalid.has('fgr')}
              hint="Anything other than ultra-fast leaves a justification prompt in the report."
              step="0.001"
              min="0"
            />
          </div>
        ) : (
          <p className="text-xs text-gray-500 mt-1">
            t-squared growth, Q = {matchedGrowthRate!.value}t². 70% of the heat release is taken as
            convective.
          </p>
        )}
      </div>

      <NumberField
        label="Detection time"
        unit="s"
        value={shared.detectionTime}
        onChange={(v) => onChange('detectionTime', v)}
        invalid={invalid.has('detectionTime')}
        min="0"
      />
      <NumberField
        label="Pre-movement time"
        unit="s"
        value={shared.preMovementTime}
        onChange={(v) => onChange('preMovementTime', v)}
        invalid={invalid.has('preMovementTime')}
        hint="BS 7974-6 Table E.2. 180 s is the report's standard justification."
        min="0"
      />
      <NumberField
        label="Walking speed"
        unit="m/s"
        value={shared.walkingSpeed}
        onChange={(v) => onChange('walkingSpeed', v)}
        invalid={invalid.has('walkingSpeed')}
        hint="CIBSE Guide E: 1.2 m/s on the flat."
        min="0"
        step="0.1"
      />
      <NumberField
        label="Flow rate"
        unit="people/s/m"
        value={shared.flowRate}
        onChange={(v) => onChange('flowRate', v)}
        invalid={invalid.has('flowRate')}
        hint="1.33 for populations over 220 (PD 7974-6 Table G.4)."
        min="0"
        step="0.01"
      />
      <NumberField
        label="Tenability height"
        unit="m"
        value={shared.tenabilityHeight}
        onChange={(v) => onChange('tenabilityHeight', v)}
        invalid={invalid.has('tenabilityHeight')}
        hint="Clear height at which the layer is taken to compromise escape; ASET is when the layer reaches it. 2 m is head height (CIBSE Guide E)."
        min="0"
        step="0.1"
      />
      <NumberField
        label="Assessment time"
        unit="s"
        value={shared.assessmentTime}
        onChange={(v) => onChange('assessmentTime', v)}
        invalid={invalid.has('assessmentTime')}
        hint="The run stops here, or 30 s after the layer reaches the tenability height."
        min="1"
      />
      <NumberField
        label="Timestep"
        unit="s"
        value={shared.tstep}
        onChange={(v) => onChange('tstep', v)}
        invalid={invalid.has('tstep')}
        hint="1 s matches the original spreadsheet. The report's mass-flow wording assumes 1 s and is not rewritten for other values."
        min="0.01"
        step="0.1"
      />
    </div>
  );
}
