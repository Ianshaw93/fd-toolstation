'use client';

import { useEffect, useMemo, useState } from 'react';

import CollapsibleSection from '../fee-proposal/CollapsibleSection';
import AssessmentSection from './AssessmentSection';
import EscapeSection from './EscapeSection';
import ResultsSummary from './ResultsSummary';
import RoomFireSection from './RoomFireSection';
import SavedRunsBar from './SavedRunsBar';
import SmokeCharts from './SmokeCharts';

import { fetchEngineers } from '../../lib/fee-api';
import type { Engineer } from '../../lib/fee-types';
import { calculateSmokeLayer } from '../../lib/smoke-layer-calc';
import { generateSmokeLayerReport } from '../../lib/smoke-layer-api';
import {
  DEFAULT_FORM,
  FIELD_LABELS,
  parseForm,
  toFormState,
  type SmokeLayerFormState,
} from '../../lib/smoke-layer-form';
import type { SavedRun, SmokeLayerInputs, SmokeLayerResults } from '../../lib/smoke-layer-types';

const controlClass =
  'w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';

type Outcome =
  | { state: 'incomplete'; missing: (keyof SmokeLayerInputs)[] }
  | { state: 'invalid'; message: string }
  | { state: 'ok'; inputs: SmokeLayerInputs; results: SmokeLayerResults };

export default function SmokeLayerForm() {
  const [form, setForm] = useState<SmokeLayerFormState>(DEFAULT_FORM);
  const [projectName, setProjectName] = useState('');
  const [engineerName, setEngineerName] = useState('');
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchEngineers()
      .then(setEngineers)
      .catch(() => {});
  }, []);

  const handleChange = (field: keyof SmokeLayerFormState, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  // The model is cheap, so it re-runs on every keystroke rather than behind a
  // Calculate button — the charts track the inputs directly.
  const outcome = useMemo<Outcome>(() => {
    const parsed = parseForm(form);
    if (!parsed.ok) return { state: 'incomplete', missing: parsed.missing };
    try {
      return { state: 'ok', inputs: parsed.inputs, results: calculateSmokeLayer(parsed.inputs) };
    } catch (e) {
      return { state: 'invalid', message: e instanceof Error ? e.message : 'Calculation failed' };
    }
  }, [form]);

  const invalidFields = useMemo(
    () => new Set(outcome.state === 'incomplete' ? outcome.missing : []),
    [outcome],
  );

  function handleLoadRun(run: SavedRun) {
    setForm(toFormState(run.inputs));
    if (run.project_name) setProjectName(run.project_name);
  }

  async function handleReport() {
    if (outcome.state !== 'ok') return;
    setGenerating(true);
    setReportError(null);
    try {
      await generateSmokeLayerReport({
        project_name: projectName,
        engineer_name: engineerName,
        inputs: outcome.inputs,
        results: outcome.results,
      });
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 items-start">
      {/* Inputs */}
      <div className="xl:sticky xl:top-6">
        <CollapsibleSection title="Project">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-1">
                Project name
              </label>
              <input
                id="project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className={controlClass}
              />
            </div>
            <div>
              <label htmlFor="engineer" className="block text-sm font-medium text-gray-700 mb-1">
                Engineer
              </label>
              <select
                id="engineer"
                value={engineerName}
                onChange={(e) => setEngineerName(e.target.value)}
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
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Room and fire">
          <RoomFireSection form={form} onChange={handleChange} invalid={invalidFields} />
        </CollapsibleSection>

        <CollapsibleSection title="Means of escape">
          <EscapeSection form={form} onChange={handleChange} invalid={invalidFields} />
        </CollapsibleSection>

        <CollapsibleSection title="Assessment" defaultOpen={false}>
          <AssessmentSection form={form} onChange={handleChange} invalid={invalidFields} />
        </CollapsibleSection>
      </div>

      {/* Results */}
      <div>
        <SavedRunsBar
          inputs={outcome.state === 'ok' ? outcome.inputs : null}
          projectName={projectName}
          onLoad={handleLoadRun}
        />

        {outcome.state === 'incomplete' && (
          <div className="border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-600 text-sm">
              Fill in {outcome.missing.map((f) => FIELD_LABELS[f]).join(', ').toLowerCase()} to run
              the model.
            </p>
          </div>
        )}

        {outcome.state === 'invalid' && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-5">
            <p className="text-sm text-red-800">{outcome.message}</p>
          </div>
        )}

        {outcome.state === 'ok' && (
          <>
            <ResultsSummary
              results={outcome.results}
              assessmentTime={outcome.inputs.assessmentTime}
              referenceHeight={outcome.inputs.referenceHeight}
            />

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleReport}
                disabled={generating}
                className="px-5 py-2.5 rounded-lg bg-black hover:bg-gray-800 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? 'Generating…' : 'Download Word report'}
              </button>
              {reportError && <span className="text-sm text-red-600">{reportError}</span>}
            </div>

            <SmokeCharts
              results={outcome.results}
              referenceHeight={outcome.inputs.referenceHeight}
            />
          </>
        )}
      </div>
    </div>
  );
}
