'use client';

import { useState } from 'react';

import { FIRE_GROWTH_RATES } from '../../lib/smoke-layer-types';
import {
  SHARED_FIELDS,
  SHARED_FIELD_LABELS,
  SHARED_FIELD_UNITS,
  describeSharedValue,
  effectiveShared,
  withOverride,
  withoutOverride,
  type BuildingField,
  type BuildingForm,
  type SharedField,
  type SharedForm,
} from '../../lib/smoke-layer-project';

interface AssumptionsMatrixProps {
  shared: SharedForm;
  buildings: BuildingForm[];
  onSharedChange: (field: SharedField, value: string) => void;
  onBuildingChange: (id: string, patch: Partial<BuildingForm>) => void;
  /** Per building, the fields the model could not read (blank or junk overrides). */
  problems: Map<string, Set<BuildingField>>;
}

const STEPS: Partial<Record<SharedField, string>> = {
  fgr: '0.001',
  walkingSpeed: '0.1',
  flowRate: '0.01',
  tenabilityHeight: '0.1',
  tstep: '0.1',
};

type CellKind = 'shared' | 'inherited' | 'override';

const cellBase =
  'w-24 px-2 py-1 rounded-md border text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';

/** How a cell looks: the engineer's own value, or the shared one shown through. */
function cellClass(kind: CellKind, invalid: boolean): string {
  if (invalid) return `${cellBase} border-red-400 bg-red-50 text-gray-900`;
  if (kind === 'inherited') return `${cellBase} border-dashed border-gray-300 text-gray-400 bg-transparent`;
  if (kind === 'override') return `${cellBase} border-blue-400 border-l-4 text-gray-900 bg-blue-50/40`;
  return `${cellBase} border-gray-300 text-gray-900`;
}

function isStandardRate(value: string): boolean {
  return FIRE_GROWTH_RATES.some((r) => String(r.value) === value.trim());
}

interface CellProps {
  field: SharedField;
  value: string;
  kind: CellKind;
  invalid: boolean;
  label: string;
  title?: string;
  onChange: (value: string) => void;
}

/**
 * One editable value. The growth rate is a dropdown of the standard t² rates
 * with a Custom choice that opens a coefficient box; everything else is a number.
 */
function Cell({ field, value, kind, invalid, label, title, onChange }: CellProps) {
  const common = {
    'aria-label': label,
    'aria-invalid': invalid || undefined,
    'data-inherited': kind === 'shared' ? undefined : String(kind === 'inherited'),
    title,
  };

  if (field === 'fgr') {
    const standard = isStandardRate(value);
    return (
      <div className="flex flex-col items-end gap-1">
        <select
          {...common}
          value={standard ? value.trim() : 'custom'}
          onChange={(e) => onChange(e.target.value === 'custom' ? '' : e.target.value)}
          className={`${cellClass(kind, invalid)} text-left`}
        >
          {FIRE_GROWTH_RATES.map((r) => (
            <option key={r.label} value={String(r.value)}>
              {r.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        {!standard && (
          <input
            aria-label={`${label} coefficient`}
            type="number"
            inputMode="decimal"
            step={STEPS.fgr}
            min="0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cellClass(kind, invalid)}
          />
        )}
      </div>
    );
  }

  return (
    <input
      {...common}
      type="number"
      inputMode="decimal"
      step={STEPS[field]}
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cellClass(kind, invalid)}
    />
  );
}

/**
 * Every assumption for every building, side by side. The shared column is the
 * same state as the "Assumptions for all buildings" section. A building's cell
 * shows the shared value through, greyed, until the engineer types in it; from
 * then on it is that building's own value, marked with a blue bar, and a
 * change to the shared value no longer reaches it until it is reset.
 */
export default function AssumptionsMatrix({
  shared,
  buildings,
  onSharedChange,
  onBuildingChange,
  problems,
}: AssumptionsMatrixProps) {
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  const differs = (field: SharedField) => buildings.some((b) => field in b.overrides);
  const rows = onlyDifferences ? SHARED_FIELDS.filter(differs) : SHARED_FIELDS;
  const nameOf = (b: BuildingForm, i: number) => b.name.trim() || `Unit ${i + 1}`;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <p className="text-xs text-gray-500 max-w-md">
          Greyed cells follow the shared column. Type in one to give that building its own value; the
          blue bar marks it and × puts it back on the shared value.
        </p>
        <label className="flex items-center gap-2 text-xs text-gray-700 whitespace-nowrap">
          <input
            type="checkbox"
            checked={onlyDifferences}
            onChange={(e) => setOnlyDifferences(e.target.checked)}
            className="h-4 w-4"
            aria-label="Show only differences"
          />
          Show only differences
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-600 border border-gray-200 rounded-lg p-4 text-center">
          Every building uses the shared assumptions.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <caption className="sr-only">Assumptions by building</caption>
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th scope="col" className="pb-2 pr-3 font-medium">Assumption</th>
                <th scope="col" className="pb-2 pr-3 font-medium">Shared</th>
                {buildings.map((b, i) => (
                  <th key={b.id} scope="col" className="pb-2 pr-3 font-medium">
                    {nameOf(b, i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((field) => {
                const label = SHARED_FIELD_LABELS[field];
                return (
                  <tr key={field} className="border-t border-gray-100 align-top">
                    <th scope="row" className="py-2 pr-3 font-medium text-gray-700 text-left whitespace-nowrap">
                      {label}
                      {field !== 'fgr' && (
                        <span className="text-gray-400 font-normal"> ({SHARED_FIELD_UNITS[field]})</span>
                      )}
                    </th>
                    <td className="py-2 pr-3">
                      <Cell
                        field={field}
                        value={shared[field]}
                        kind="shared"
                        invalid={shared[field].trim() === ''}
                        label={`Shared ${label}`}
                        onChange={(v) => onSharedChange(field, v)}
                      />
                    </td>
                    {buildings.map((b, i) => {
                      const overridden = field in b.overrides;
                      const invalid = problems.get(b.id)?.has(field) ?? false;
                      return (
                        <td key={b.id} className="py-2 pr-3">
                          <div className="flex items-start gap-1">
                            <Cell
                              field={field}
                              value={effectiveShared(shared, b, field)}
                              kind={overridden ? 'override' : 'inherited'}
                              invalid={invalid}
                              label={`${label} for ${nameOf(b, i)}`}
                              title={overridden ? `Shared value: ${describeSharedValue(field, shared[field])}` : undefined}
                              onChange={(v) => onBuildingChange(b.id, { overrides: withOverride(b, field, v).overrides })}
                            />
                            {overridden && (
                              <button
                                type="button"
                                onClick={() => onBuildingChange(b.id, { overrides: withoutOverride(b, field).overrides })}
                                aria-label={`Reset ${label} for ${nameOf(b, i)} to shared`}
                                title="Back to the shared value"
                                className="mt-1 text-gray-400 hover:text-gray-900 text-base leading-none"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
