'use client';

import { useState, useEffect } from 'react';
import type { ProjectDetails } from '../../lib/efs-types';
import { fetchEngineers } from '../../lib/fee-api';
import type { Engineer } from '../../lib/fee-types';

interface ProjectDetailsSectionProps extends ProjectDetails {
  onChange: (field: keyof ProjectDetails, value: string) => void;
}

const RIBA_STAGES = ['1', '2', '3', '4', '5', '6'];

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';
const labelClass = 'text-sm font-medium text-gray-700';

export default function ProjectDetailsSection({
  projectName,
  projectLocation,
  ribaDesignStage,
  engineerName,
  clientName,
  onChange,
}: ProjectDetailsSectionProps) {
  const [engineers, setEngineers] = useState<Engineer[]>([]);

  useEffect(() => {
    fetchEngineers()
      .then(setEngineers)
      .catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label htmlFor="projectName" className={labelClass}>
          Project Name
        </label>
        <input
          id="projectName"
          type="text"
          value={projectName}
          onChange={(e) => onChange('projectName', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="projectLocation" className={labelClass}>
          Project Location
        </label>
        <input
          id="projectLocation"
          type="text"
          value={projectLocation}
          onChange={(e) => onChange('projectLocation', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="ribaDesignStage" className={labelClass}>
          RIBA Design Stage
        </label>
        <select
          id="ribaDesignStage"
          value={ribaDesignStage}
          onChange={(e) => onChange('ribaDesignStage', e.target.value)}
          className={inputClass}
        >
          {RIBA_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="engineerName" className={labelClass}>
          Engineer&apos;s Name
        </label>
        <select
          id="engineerName"
          value={engineerName}
          onChange={(e) => onChange('engineerName', e.target.value)}
          className={inputClass}
        >
          <option value="">Select Engineer</option>
          {engineers.map((eng) => (
            <option key={eng.full_name} value={eng.full_name}>
              {eng.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="clientName" className={labelClass}>
          Client Name
        </label>
        <input
          id="clientName"
          type="text"
          value={clientName}
          onChange={(e) => onChange('clientName', e.target.value)}
          className={inputClass}
        />
      </div>
    </div>
  );
}
