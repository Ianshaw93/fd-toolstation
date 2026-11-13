'use client';

import { Dispatch } from 'react';
import type { ProjectDetails } from '../../lib/fee-types';
import { COUNTRIES, LEGISLATION_REFERENCES } from '../../lib/fee-constants';
import type { FieldProvenance } from '../../lib/field-provenance';
import type { DirectoryProposals } from '../../lib/directory-proposals';
import type { SynergyOfferMap } from '../../hooks/useFeeProposal';
import type { PreviousFeeOptionsMap } from '../../lib/word-addin-api';
import FieldProposalReview from './FieldProposalReview';
import PreviousOptionPicker from './PreviousOptionPicker';
import SourceBadge from './SourceBadge';

interface Props {
  project: ProjectDetails;
  dispatch: Dispatch<any>;
  /** Word task pane only: where autofilled values came from. */
  provenance?: Pick<FieldProvenance, 'projectName' | 'location' | 'country'>;
  /** Word task pane only: project values offered for fields the user owns. */
  proposals?: DirectoryProposals;
  /** Word task pane only: deduplicated options from past non-test fee generations. */
  previousOptions?: PreviousFeeOptionsMap | null;
  /** Word task pane only: raw values offered by Total Synergy on the current project. */
  synergyOffer?: SynergyOfferMap;
}

export default function ProjectDetailsSection({ project, dispatch, provenance, proposals, previousOptions, synergyOffer }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-sm font-medium text-gray-700">Project Name</label>
          <SourceBadge provenance={provenance?.projectName} testId="source-project-name" />
        </div>
        <input
          type="text"
          value={project.project_name}
          onChange={(e) => dispatch({ type: 'SET_PROJECT', field: 'project_name', value: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
        <FieldProposalReview field="projectName" proposal={proposals?.projectName} dispatch={dispatch} />
        <PreviousOptionPicker
          field="projectName"
          label="Project name"
          synergyValue={synergyOffer?.projectName}
          previousOptions={previousOptions?.projectName}
          currentValue={project.project_name}
          dispatch={dispatch}
        />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-sm font-medium text-gray-700">Project Location</label>
          <SourceBadge provenance={provenance?.location} testId="source-location" />
        </div>
        <input
          type="text"
          value={project.project_location}
          onChange={(e) => dispatch({ type: 'SET_PROJECT', field: 'project_location', value: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
        <PreviousOptionPicker
          field="location"
          label="Project location"
          previousOptions={previousOptions?.projectLocation}
          currentValue={project.project_location}
          dispatch={dispatch}
        />
      </div>
      <div className="md:col-span-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="block text-sm font-medium text-gray-700">Project Country</span>
          <SourceBadge provenance={provenance?.country} testId="source-country" />
        </div>
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
        <FieldProposalReview field="country" proposal={proposals?.country} dispatch={dispatch} />
        <PreviousOptionPicker
          field="country"
          label="Project country"
          synergyValue={synergyOffer?.country}
          previousOptions={previousOptions?.country}
          currentValue={project.country}
          dispatch={dispatch}
        />
      </div>
      {project.country === 'OTHER' && (
        <>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">VAT Applicable</label>
          <div className="flex gap-4">
            {[
              { value: true, label: 'Yes' },
              { value: false, label: 'No' },
            ].map((o) => (
              <label key={o.label} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vat_applicable"
                  checked={project.vat_applicable === o.value}
                  onChange={() => dispatch({ type: 'SET_PROJECT', field: 'vat_applicable', value: o.value })}
                  className="w-4 h-4 text-gray-900"
                />
                <span className="text-sm text-gray-700">{o.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            When Yes, fees in the proposal are quoted exclusive of VAT.
          </p>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="legislation" className="block text-sm font-medium text-gray-700 mb-1">
            Legislation
          </label>
          <input
            id="legislation"
            type="text"
            value={project.legislation}
            placeholder="e.g. Building Bye Laws (Guernsey) 2012"
            onChange={(e) => dispatch({ type: 'SET_PROJECT', field: 'legislation', value: e.target.value })}
            className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          />
          <p className="mt-2 text-xs text-gray-500">
            Quoted throughout the proposal, e.g. &ldquo;complies with the functional requirements
            of &hellip;&rdquo;. Left blank, the England or Wales reference is used. For reference:
          </p>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            {LEGISLATION_REFERENCES.map((ref) => (
              <div key={ref.label}>
                <label htmlFor={`legislation-ref-${ref.label}`} className="block text-xs text-gray-500 mb-1">
                  {ref.label}
                </label>
                <input
                  id={`legislation-ref-${ref.label}`}
                  type="text"
                  readOnly
                  value={ref.text}
                  className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600"
                />
              </div>
            ))}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
