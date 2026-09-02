'use client';

import type { ReportDetailsForm } from '../../lib/smoke-layer-report';

interface ReportDetailsSectionProps {
  details: ReportDetailsForm;
  onChange: <K extends keyof ReportDetailsForm>(field: K, value: ReportDetailsForm[K]) => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
const hintClass = 'mt-1 text-xs text-gray-500';

function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? 'md:col-span-2' : undefined}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {multiline ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={inputClass} />
      ) : (
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

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
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

/**
 * Wording inputs for the Word report. Nothing here changes the calculation; blanks
 * become highlighted "engineer to edit" prompts in the document.
 */
export default function ReportDetailsSection({ details, onChange }: ReportDetailsSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TextField id="client-name" label="Client" value={details.client_name} onChange={(v) => onChange('client_name', v)} />
      <TextField
        id="project-location"
        label="Project location"
        value={details.project_location}
        onChange={(v) => onChange('project_location', v)}
      />
      <TextField
        id="building-name"
        label="Building name"
        value={details.building_name}
        onChange={(v) => onChange('building_name', v)}
        hint='e.g. "Unit 1"'
      />
      <TextField
        id="intended-purpose"
        label="Intended fit-out"
        value={details.intended_purpose}
        onChange={(v) => onChange('intended_purpose', v)}
        hint='e.g. "storage and distribution purposes". Leave blank if the fit-out is unknown.'
      />
      <TextField
        id="site-description"
        label="Site description"
        value={details.site_description}
        onChange={(v) => onChange('site_description', v)}
        hint='Completes "The … development consists of …". Leave blank to write it in Word.'
        multiline
      />

      <Checkbox
        id="has-undercroft"
        label="Office undercroft present (smoke cannot spread beneath the offices)"
        checked={details.has_undercroft}
        onChange={(v) => onChange('has_undercroft', v)}
      />
      <TextField
        id="office-storeys"
        label="Office storeys above the warehouse"
        value={details.office_storeys}
        onChange={(v) => onChange('office_storeys', v)}
      />
      <TextField
        id="office-height"
        label="Top office floor height above ground"
        value={details.office_height}
        onChange={(v) => onChange('office_height', v)}
        hint='e.g. "8.5m"'
      />
      <TextField id="staircases" label="Staircases serving the offices" value={details.staircases} onChange={(v) => onChange('staircases', v)} />

      <Checkbox
        id="racking-known"
        label="Racking percentage comes from a proposed layout"
        checked={details.racking_known}
        onChange={(v) => onChange('racking_known', v)}
      />
      {details.racking_known && (
        <TextField
          id="racking-source"
          label="Racking source"
          value={details.racking_source}
          onChange={(v) => onChange('racking_source', v)}
          hint='e.g. "indicative fit-out drawing in Appendix A"'
        />
      )}

      <Checkbox
        id="occupancy-known"
        label="Occupancy rates come from a project document"
        checked={details.occupancy_known}
        onChange={(v) => onChange('occupancy_known', v)}
      />
      {details.occupancy_known && (
        <>
          <TextField
            id="occupancy-source"
            label="Occupancy source (in text)"
            value={details.occupancy_source}
            onChange={(v) => onChange('occupancy_source', v)}
            hint='e.g. "the Fire Strategy Report supplied by Michael Sparks Associates"'
          />
          <TextField
            id="occupancy-reference"
            label="Occupancy reference (reference list entry [2])"
            value={details.occupancy_reference}
            onChange={(v) => onChange('occupancy_reference', v)}
          />
        </>
      )}

      <TextField
        id="number-of-doors"
        label="Number of exit doors"
        value={details.number_of_doors}
        onChange={(v) => onChange('number_of_doors', v)}
        hint="With the door width, replaces the total-exit-width sentence."
      />
      <TextField id="door-width" label="Door clear width (mm)" value={details.door_width_mm} onChange={(v) => onChange('door_width_mm', v)} />
    </div>
  );
}
