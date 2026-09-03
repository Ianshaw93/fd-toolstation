'use client';

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Element id; defaults to one derived from the label. Pass one when the same label repeats on a page. */
  id?: string;
  /** Shown after the input, e.g. "m²". */
  unit?: string;
  /** Small note under the field — guidance, a default, or a derived value. */
  hint?: string;
  step?: string;
  min?: string;
  max?: string;
  invalid?: boolean;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';

export default function NumberField({
  label,
  value,
  onChange,
  id,
  unit,
  hint,
  step,
  min,
  max,
  invalid = false,
}: NumberFieldProps) {
  const fieldId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {unit && <span className="text-gray-400 font-normal"> ({unit})</span>}
      </label>
      <input
        id={fieldId}
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        min={min}
        max={max}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${invalid ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
