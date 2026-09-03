'use client';

import NumberField from './NumberField';
import type { Engineer } from '../../lib/fee-types';
import type { ProjectField, ProjectForm } from '../../lib/smoke-layer-project';

interface ProjectSectionProps {
  project: ProjectForm;
  engineers: Engineer[];
  onChange: <K extends ProjectField>(field: K, value: ProjectForm[K]) => void;
  invalid: Set<ProjectField>;
}

const controlClass =
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
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={controlClass} />
      ) : (
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} className={controlClass} />
      )}
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

/**
 * Project-level inputs: who and where, plus the report wording that applies to
 * every building. Nothing here changes the calculation; blank text becomes a
 * highlighted "engineer to edit" prompt in the Word document.
 */
export default function ProjectSection({ project, engineers, onChange, invalid }: ProjectSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TextField id="project-name" label="Project name" value={project.projectName} onChange={(v) => onChange('projectName', v)} />
      <div>
        <label htmlFor="engineer" className={labelClass}>
          Engineer
        </label>
        <select
          id="engineer"
          value={project.engineerName}
          onChange={(e) => onChange('engineerName', e.target.value)}
          className={controlClass}
        >
          <option value="">Select Engineer</option>
          {engineers.map((eng) => (
            <option key={eng.full_name} value={eng.full_name}>
              {eng.full_name}
            </option>
          ))}
        </select>
      </div>
      <TextField id="client-name" label="Client" value={project.clientName} onChange={(v) => onChange('clientName', v)} />
      <TextField
        id="project-location"
        label="Project location"
        value={project.projectLocation}
        onChange={(v) => onChange('projectLocation', v)}
      />
      <TextField
        id="site-description"
        label="Site description"
        value={project.siteDescription}
        onChange={(v) => onChange('siteDescription', v)}
        hint='Completes "The … development consists of …". Leave blank to write it in Word.'
        multiline
      />
      <TextField
        id="intended-purpose"
        label="Intended fit-out"
        value={project.intendedPurpose}
        onChange={(v) => onChange('intendedPurpose', v)}
        hint='e.g. "storage and distribution purposes". Leave blank if the fit-out is unknown.'
      />
      <NumberField
        id="staircases"
        label="Staircases serving the offices"
        value={project.staircases}
        onChange={(v) => onChange('staircases', v)}
        invalid={invalid.has('staircases')}
        hint="Whole number. Blank leaves the office paragraph for the engineer."
        min="0"
        step="1"
      />
      <TextField
        id="racking-source"
        label="Racking source"
        value={project.rackingSource}
        onChange={(v) => onChange('rackingSource', v)}
        hint='Where any known racking percentages come from, e.g. "indicative fit-out drawing in Appendix B".'
      />

      <label htmlFor="occupancy-known" className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
        <input
          id="occupancy-known"
          type="checkbox"
          checked={project.occupancyKnown}
          onChange={(e) => onChange('occupancyKnown', e.target.checked)}
          className="h-4 w-4"
        />
        Occupancy figures come from a project document
      </label>
      {project.occupancyKnown && (
        <>
          <TextField
            id="occupancy-source"
            label="Occupancy source (in text)"
            value={project.occupancySource}
            onChange={(v) => onChange('occupancySource', v)}
            hint='e.g. "the Fire Strategy Report supplied by Michael Sparks Associates"'
          />
          <TextField
            id="occupancy-reference"
            label="Occupancy reference (reference list entry [2])"
            value={project.occupancyReference}
            onChange={(v) => onChange('occupancyReference', v)}
          />
        </>
      )}
    </div>
  );
}
