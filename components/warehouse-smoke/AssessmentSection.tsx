'use client';

import NumberField from './NumberField';
import { TENABILITY_HEIGHT } from '../../lib/smoke-layer-types';
import type { SmokeLayerFormState } from '../../lib/smoke-layer-form';

interface AssessmentSectionProps {
  form: SmokeLayerFormState;
  onChange: (field: keyof SmokeLayerFormState, value: string) => void;
  invalid: Set<keyof SmokeLayerFormState>;
}

export default function AssessmentSection({ form, onChange, invalid }: AssessmentSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumberField
        label="Assessment time"
        unit="s"
        value={form.assessmentTime}
        onChange={(v) => onChange('assessmentTime', v)}
        invalid={invalid.has('assessmentTime')}
        hint="The run stops here, or 30 s after the layer reaches 2 m."
        min="1"
      />
      <NumberField
        label="Timestep"
        unit="s"
        value={form.tstep}
        onChange={(v) => onChange('tstep', v)}
        invalid={invalid.has('tstep')}
        hint="1 s matches the original spreadsheet."
        min="0.01"
        step="0.1"
      />
      <div className="md:col-span-2">
        <NumberField
          label="Reference height"
          unit="m"
          value={form.referenceHeight}
          onChange={(v) => onChange('referenceHeight', v)}
          invalid={invalid.has('referenceHeight')}
          hint={`An additional height of interest, such as a beam soffit or mezzanine. The ${TENABILITY_HEIGHT} m tenability limit is always assessed.`}
          min="0"
          step="0.1"
        />
      </div>
    </div>
  );
}
