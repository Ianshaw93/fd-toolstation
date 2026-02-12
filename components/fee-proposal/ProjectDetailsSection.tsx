'use client';

import { Dispatch } from 'react';
import type { ProjectDetails } from '../../lib/fee-types';
import { COUNTRIES } from '../../lib/fee-constants';

interface Props {
  project: ProjectDetails;
  dispatch: Dispatch<any>;
}

export default function ProjectDetailsSection({ project, dispatch }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
        <input
          type="text"
          value={project.project_name}
          onChange={(e) => dispatch({ type: 'SET_PROJECT', field: 'project_name', value: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Project Location</label>
        <input
          type="text"
          value={project.project_location}
          onChange={(e) => dispatch({ type: 'SET_PROJECT', field: 'project_location', value: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Project Country</label>
        <div className="flex gap-4">
          {COUNTRIES.map((c) => (
            <label key={c.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="country"
                value={c.value}
                checked={project.country === c.value}
                onChange={() => dispatch({ type: 'SET_PROJECT', field: 'country', value: c.value })}
                className="w-4 h-4 text-gray-900"
              />
              <span className="text-sm text-gray-700">{c.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
