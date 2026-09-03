'use client';

import NumberField from './NumberField';
import {
  DEFAULT_OCCUPANCY_DENSITY,
  SHARED_FIELD_LABELS,
  defaultOccupancy,
  describeSharedValue,
  overriddenFields,
  withoutOverride,
  type BuildingField,
  type BuildingForm,
  type DoorGroupForm,
  type SharedForm,
} from '../../lib/smoke-layer-project';

interface BuildingCardProps {
  building: BuildingForm;
  index: number;
  onChange: (patch: Partial<BuildingForm>) => void;
  onRemove: () => void;
  canRemove: boolean;
  /** Required fields that are blank or not a number. */
  missing: Set<BuildingField>;
  /** Fields holding something that is not the right kind of number. */
  invalid: Set<BuildingField>;
  /** The exit width the door schedule gives, when it parses. */
  derivedExitWidth: number | null;
  /** The document's shared assumptions, so an override can say what it departs from. */
  shared: SharedForm;
}

const controlClass =
  'w-full px-3 py-2 rounded-lg border text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';
const smallButton = 'text-xs text-gray-600 hover:text-gray-900 underline';

function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-gray-700">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

/** One building's inputs: the calculation inputs that vary per unit plus its report details. */
export default function BuildingCard({
  building,
  index,
  onChange,
  onRemove,
  canRemove,
  missing,
  invalid,
  derivedExitWidth,
  shared,
}: BuildingCardProps) {
  const id = (field: string) => `b-${building.id}-${field}`;
  const overrides = overriddenFields(building);
  const flagged = (field: BuildingField) => missing.has(field) || invalid.has(field);

  const area = Number(building.roomArea);
  const suggestedOccupancy =
    building.roomArea.trim() !== '' && Number.isFinite(area) ? Math.ceil(defaultOccupancy(area)) : null;
  const showSuggestion = suggestedOccupancy !== null && building.occupancy !== String(suggestedOccupancy);

  const racking = Number(building.rackingPerc);
  const smokeArea =
    Number.isFinite(area) && Number.isFinite(racking) && building.roomArea !== '' && racking < 100
      ? area * (1 - racking / 100)
      : null;

  const updateDoor = (i: number, patch: Partial<DoorGroupForm>) =>
    onChange({ doors: building.doors.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const addDoorRow = () => onChange({ doors: [...building.doors, { count: '', widthMm: '' }] });
  const removeDoorRow = (i: number) => onChange({ doors: building.doors.filter((_, j) => j !== i) });

  const exitWidthHint = (() => {
    if (building.exitWidthOverride.trim() !== '') {
      return derivedExitWidth !== null
        ? `Overrides the ${derivedExitWidth.toLocaleString('en-GB', { maximumFractionDigits: 2 })} m the doors give. The doors are still listed in the report.`
        : 'Used in place of the door schedule.';
    }
    if (derivedExitWidth !== null) {
      return `${derivedExitWidth.toLocaleString('en-GB', { maximumFractionDigits: 2 })} m from the doors, with the single largest door discounted.`;
    }
    return 'Leave blank to derive it from the doors, or enter the total clear width in metres.';
  })();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2 flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor={id('name')} className="block text-sm font-medium text-gray-700 mb-1">
            Building name
          </label>
          <input
            id={id('name')}
            type="text"
            value={building.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={`Unit ${index + 1}`}
            className={`${controlClass} border-gray-300`}
          />
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} className="px-3 py-2 text-sm text-red-700 hover:text-red-900">
            Remove
          </button>
        )}
      </div>

      {overrides.length > 0 && (
        <div className="md:col-span-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-600">Own assumptions:</span>
          {overrides.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-blue-900"
              title={`Shared value: ${describeSharedValue(f, shared[f])}`}
            >
              {SHARED_FIELD_LABELS[f]} {describeSharedValue(f, building.overrides[f] ?? '')}
              <button
                type="button"
                onClick={() => onChange({ overrides: withoutOverride(building, f).overrides })}
                aria-label={`Use shared ${SHARED_FIELD_LABELS[f]}`}
                className="text-blue-700 hover:text-blue-900 leading-none"
              >
                ×
              </button>
            </span>
          ))}
          <span className="text-gray-500">Edit under Assumptions by building.</span>
        </div>
      )}

      <NumberField
        id={id('room-area')}
        label="Floor area"
        unit="m²"
        value={building.roomArea}
        onChange={(v) => onChange({ roomArea: v })}
        invalid={flagged('roomArea')}
        hint="Warehouse floor, excluding any office undercroft."
        min="0"
      />
      <NumberField
        id={id('room-height')}
        label="Room height"
        unit="m"
        value={building.roomHeight}
        onChange={(v) => onChange({ roomHeight: v })}
        invalid={flagged('roomHeight')}
        hint="Average clear height to the underside of the roof."
        min="0"
        step="0.1"
      />
      <NumberField
        id={id('racking')}
        label="Racking"
        unit="% of volume"
        value={building.rackingPerc}
        onChange={(v) => onChange({ rackingPerc: v })}
        invalid={flagged('rackingPerc')}
        hint={
          smokeArea === null
            ? 'Use 50% as standard. Racking displaces volume, reducing the area the smoke fills.'
            : `Smoke fills ${smokeArea.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m² of plan area.`
        }
        min="0"
        max="99"
        step="1"
      />
      <div className="flex flex-col justify-end gap-2 pb-1">
        <Checkbox
          id={id('racking-known')}
          label="Racking figure comes from a proposed layout"
          checked={building.rackingKnown}
          onChange={(v) => onChange({ rackingKnown: v })}
        />
        <Checkbox
          id={id('undercroft')}
          label="Office undercroft (smoke cannot spread beneath the offices)"
          checked={building.hasUndercroft}
          onChange={(v) => onChange({ hasUndercroft: v })}
        />
      </div>

      <NumberField
        id={id('office-storeys')}
        label="Office storeys above the warehouse"
        value={building.officeStoreys}
        onChange={(v) => onChange({ officeStoreys: v })}
        invalid={flagged('officeStoreys')}
        hint="Whole number. Blank = describe in Word."
        min="0"
        step="1"
      />
      <NumberField
        id={id('office-height')}
        label="Top office floor above ground"
        unit="m"
        value={building.officeHeightM}
        onChange={(v) => onChange({ officeHeightM: v })}
        invalid={flagged('officeHeightM')}
        min="0"
        step="0.1"
      />

      <div className="md:col-span-2">
        <span className="block text-sm font-medium text-gray-700 mb-1">
          Exit doors <span className="text-gray-400 font-normal">(count × clear width)</span>
        </span>
        <div className={`rounded-lg border p-3 ${flagged('doors') ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-1 font-medium">Number of doors</th>
                <th className="pb-1 font-medium">Width of each (mm)</th>
                <th className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {building.doors.map((door, i) => (
                <tr key={i}>
                  <td className="pr-2 py-1">
                    <input
                      aria-label={`Door group ${i + 1} count`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={door.count}
                      onChange={(e) => updateDoor(i, { count: e.target.value })}
                      className={`${controlClass} border-gray-300`}
                    />
                  </td>
                  <td className="pr-2 py-1">
                    <input
                      aria-label={`Door group ${i + 1} width (mm)`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="10"
                      value={door.widthMm}
                      onChange={(e) => updateDoor(i, { widthMm: e.target.value })}
                      className={`${controlClass} border-gray-300`}
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeDoorRow(i)}
                      className={smallButton}
                      aria-label={`Remove door group ${i + 1}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addDoorRow} className={`${smallButton} mt-1`}>
            Add door group
          </button>
          <p className="text-xs text-gray-500 mt-2">
            One door of the largest width is discounted, unless it is the only door. A blank row is ignored.
          </p>
        </div>
      </div>

      <NumberField
        id={id('exit-width')}
        label="Total exit width"
        unit="m"
        value={building.exitWidthOverride}
        onChange={(v) => onChange({ exitWidthOverride: v })}
        invalid={flagged('exitWidthOverride')}
        hint={exitWidthHint}
        min="0"
        step="0.1"
      />
      <NumberField
        id={id('travel')}
        label="Maximum travel distance"
        unit="m"
        value={building.maximumTravelDistance}
        onChange={(v) => onChange({ maximumTravelDistance: v })}
        invalid={flagged('maximumTravelDistance')}
        min="0"
        step="0.5"
      />

      <div className="md:col-span-2">
        <NumberField
          id={id('occupancy')}
          label="Occupancy"
          unit="people"
          value={building.occupancy}
          onChange={(v) => onChange({ occupancy: v })}
          invalid={flagged('occupancy')}
          min="0"
          step="1"
        />
        {showSuggestion && (
          <button
            type="button"
            onClick={() => onChange({ occupancy: String(suggestedOccupancy) })}
            className="text-xs text-blue-700 hover:text-blue-900 underline mt-1"
          >
            Use {suggestedOccupancy.toLocaleString('en-GB')} — one person per {DEFAULT_OCCUPANCY_DENSITY} m² of
            gross floor area
          </button>
        )}
      </div>
    </div>
  );
}
