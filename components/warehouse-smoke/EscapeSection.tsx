'use client';

import NumberField from './NumberField';
import { DEFAULT_OCCUPANCY_DENSITY, defaultOccupancy } from '../../lib/smoke-layer-form';
import type { SmokeLayerFormState } from '../../lib/smoke-layer-form';

interface EscapeSectionProps {
  form: SmokeLayerFormState;
  onChange: (field: keyof SmokeLayerFormState, value: string) => void;
  invalid: Set<keyof SmokeLayerFormState>;
}

export default function EscapeSection({ form, onChange, invalid }: EscapeSectionProps) {
  const area = Number(form.roomArea);
  const suggestedOccupancy =
    form.roomArea !== '' && Number.isFinite(area) ? Math.ceil(defaultOccupancy(area)) : null;

  const showSuggestion =
    suggestedOccupancy !== null && form.occupancy !== String(suggestedOccupancy);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumberField
        label="Detection time"
        unit="s"
        value={form.detectionTime}
        onChange={(v) => onChange('detectionTime', v)}
        invalid={invalid.has('detectionTime')}
        min="0"
      />
      <NumberField
        label="Pre-movement time"
        unit="s"
        value={form.preMovementTime}
        onChange={(v) => onChange('preMovementTime', v)}
        invalid={invalid.has('preMovementTime')}
        hint="BS 7974-6 Table E.2."
        min="0"
      />
      <NumberField
        label="Maximum travel distance"
        unit="m"
        value={form.maximumTravelDistance}
        onChange={(v) => onChange('maximumTravelDistance', v)}
        invalid={invalid.has('maximumTravelDistance')}
        min="0"
        step="0.5"
      />
      <NumberField
        label="Walking speed"
        unit="m/s"
        value={form.walkingSpeed}
        onChange={(v) => onChange('walkingSpeed', v)}
        invalid={invalid.has('walkingSpeed')}
        min="0"
        step="0.1"
      />
      <NumberField
        label="Total exit width"
        unit="m"
        value={form.totalExitWidth}
        onChange={(v) => onChange('totalExitWidth', v)}
        invalid={invalid.has('totalExitWidth')}
        min="0"
        step="0.1"
      />
      <NumberField
        label="Flow rate"
        unit="people/s/m"
        value={form.flowRate}
        onChange={(v) => onChange('flowRate', v)}
        invalid={invalid.has('flowRate')}
        min="0"
        step="0.01"
      />

      <div className="md:col-span-2">
        <NumberField
          label="Occupancy"
          unit="people"
          value={form.occupancy}
          onChange={(v) => onChange('occupancy', v)}
          invalid={invalid.has('occupancy')}
          min="0"
          step="1"
        />
        {showSuggestion && (
          <button
            type="button"
            onClick={() => onChange('occupancy', String(suggestedOccupancy))}
            className="text-xs text-blue-700 hover:text-blue-900 underline mt-1"
          >
            Use {suggestedOccupancy.toLocaleString('en-GB')} — one person per{' '}
            {DEFAULT_OCCUPANCY_DENSITY} m² of gross floor area
          </button>
        )}
      </div>
    </div>
  );
}
