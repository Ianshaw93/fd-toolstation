'use client';

import { useEffect, useMemo, useState } from 'react';

import CollapsibleSection from '../fee-proposal/CollapsibleSection';
import AssumptionsMatrix from './AssumptionsMatrix';
import BuildingCard from './BuildingCard';
import BuildingsSummaryTable from './BuildingsSummaryTable';
import ProjectSection from './ProjectSection';
import ResultsSummary from './ResultsSummary';
import SavedRunsBar from './SavedRunsBar';
import SharedAssumptionsSection from './SharedAssumptionsSection';
import SmokeCharts from './SmokeCharts';

import { fetchEngineers } from '../../lib/fee-api';
import type { Engineer } from '../../lib/fee-types';
import { generateSmokeLayerReport, type ReportDocument } from '../../lib/smoke-layer-api';
import {
  BUILDING_FIELD_LABELS,
  SHARED_FIELD_LABELS,
  buildReportRequest,
  evaluateDocument,
  newBuilding,
  newDocument,
  type BuildingField,
  type BuildingForm,
  type ProjectField,
  type ProjectForm,
  type SharedField,
  type SmokeLayerDocument,
} from '../../lib/smoke-layer-project';

const EMPTY_FIELDS = new Set<BuildingField>();

export default function SmokeLayerForm() {
  const [doc, setDoc] = useState<SmokeLayerDocument>(newDocument);
  const [selectedId, setSelectedId] = useState<string>(() => doc.buildings[0].id);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<ReportDocument | null>(null);

  useEffect(() => {
    fetchEngineers()
      .then(setEngineers)
      .catch(() => {});
  }, []);

  // The model is cheap, so every building re-runs on every keystroke rather
  // than behind a Calculate button — the charts track the inputs directly.
  const evaluation = useMemo(() => evaluateDocument(doc), [doc]);
  const request = useMemo(() => buildReportRequest(doc, evaluation), [doc, evaluation]);

  const selected =
    evaluation.buildings.find((b) => b.id === selectedId) ?? evaluation.buildings[0];
  const selectedForm = doc.buildings.find((b) => b.id === selected?.id);
  const assessmentTime = Number(doc.shared.assessmentTime);
  const anyOverrides = doc.buildings.some((b) => Object.keys(b.overrides).length > 0);

  const exceeded = evaluation.buildings.filter(
    (b) => b.outcome.state === 'ok' && b.outcome.results.marginOfSafety <= 0,
  );

  const updateProject = <K extends ProjectField>(field: K, value: ProjectForm[K]) =>
    setDoc((d) => ({ ...d, project: { ...d.project, [field]: value } }));
  const updateShared = (field: SharedField, value: string) =>
    setDoc((d) => ({ ...d, shared: { ...d.shared, [field]: value } }));
  const updateBuilding = (id: string, patch: Partial<BuildingForm>) =>
    setDoc((d) => ({ ...d, buildings: d.buildings.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  const addBuilding = () =>
    setDoc((d) => {
      const building = newBuilding(d.buildings.length);
      setSelectedId(building.id);
      return { ...d, buildings: [...d.buildings, building] };
    });
  const removeBuilding = (id: string) =>
    setDoc((d) => ({ ...d, buildings: d.buildings.filter((b) => b.id !== id) }));

  function handleLoad(loaded: SmokeLayerDocument) {
    setDoc(loaded);
    setSelectedId(loaded.buildings[0]?.id ?? '');
  }

  async function handleDownload(documentType: ReportDocument) {
    if (!request) return;
    setGenerating(documentType);
    setReportError(null);
    try {
      await generateSmokeLayerReport(request, documentType);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : `Failed to generate ${documentType}`);
    } finally {
      setGenerating(null);
    }
  }

  const sharedInvalid = useMemo(() => new Set(evaluation.sharedMissing), [evaluation]);
  const projectInvalid = useMemo(() => new Set(evaluation.projectInvalid), [evaluation]);
  // Per building, the fields that failed to parse, for the matrix to flag bad overrides.
  const buildingProblems = useMemo(() => {
    const map = new Map<string, Set<BuildingField>>();
    for (const b of evaluation.buildings) {
      if (b.outcome.state === 'incomplete') map.set(b.id, new Set([...b.outcome.missing, ...b.outcome.invalid]));
    }
    return map;
  }, [evaluation]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] gap-6 items-start">
      {/* Inputs */}
      <div>
        <CollapsibleSection title="Project">
          <p className="text-xs text-gray-500 mb-4">
            Cover page and report wording shared by every building. Blank wording becomes a
            highlighted prompt in the Word document.
          </p>
          <ProjectSection project={doc.project} engineers={engineers} onChange={updateProject} invalid={projectInvalid} />
        </CollapsibleSection>

        <CollapsibleSection title="Assumptions for all buildings" defaultOpen={false}>
          <SharedAssumptionsSection shared={doc.shared} onChange={updateShared} invalid={sharedInvalid} />
        </CollapsibleSection>

        {(doc.buildings.length > 1 || anyOverrides) && (
          <CollapsibleSection title="Assumptions by building" defaultOpen={anyOverrides}>
            <AssumptionsMatrix
              shared={doc.shared}
              buildings={doc.buildings}
              onSharedChange={updateShared}
              onBuildingChange={updateBuilding}
              problems={buildingProblems}
            />
          </CollapsibleSection>
        )}

        {doc.buildings.map((b, i) => {
          const result = evaluation.buildings.find((e) => e.id === b.id);
          const missing =
            result?.outcome.state === 'incomplete' ? new Set(result.outcome.missing) : EMPTY_FIELDS;
          const invalid =
            result?.outcome.state === 'incomplete' ? new Set(result.outcome.invalid) : EMPTY_FIELDS;
          const derived = result?.outcome.state === 'ok' ? result.outcome.derivedExitWidth : null;
          return (
            <CollapsibleSection key={b.id} title={b.name.trim() || `Unit ${i + 1}`}>
              <BuildingCard
                building={b}
                index={i}
                onChange={(patch) => updateBuilding(b.id, patch)}
                onRemove={() => removeBuilding(b.id)}
                canRemove={doc.buildings.length > 1}
                missing={missing}
                invalid={invalid}
                derivedExitWidth={derived}
                shared={doc.shared}
              />
            </CollapsibleSection>
          );
        })}

        <button
          type="button"
          onClick={addBuilding}
          className="w-full px-4 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          + Add building
        </button>
      </div>

      {/* Results */}
      <div className="xl:sticky xl:top-6">
        <SavedRunsBar document={doc} onLoad={handleLoad} />

        {evaluation.sharedMissing.length > 0 && (
          <div className="border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-600 text-sm">
              Fill in {evaluation.sharedMissing.map((f) => SHARED_FIELD_LABELS[f]).join(', ').toLowerCase()} under
              the shared assumptions to run the model.
            </p>
          </div>
        )}

        {evaluation.sharedMissing.length === 0 && (
          <>
            {evaluation.buildings.length > 1 && (
              <BuildingsSummaryTable
                buildings={evaluation.buildings}
                selectedId={selected?.id ?? ''}
                onSelect={setSelectedId}
                assessmentTime={Number.isFinite(assessmentTime) ? assessmentTime : null}
              />
            )}

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => handleDownload('report')}
                disabled={!request || generating !== null}
                className="px-5 py-2.5 rounded-lg bg-black hover:bg-gray-800 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {generating === 'report' ? 'Generating…' : 'Download Word report'}
              </button>
              <button
                type="button"
                onClick={() => handleDownload('appendix')}
                disabled={!request || generating !== null}
                title="The calculation appendix on its own, for dropping into a wider fire strategy report"
                className="px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-900 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {generating === 'appendix' ? 'Generating…' : 'Download appendix only'}
              </button>
              {!request && (
                <span className="text-xs text-gray-500">
                  Available once every building has run and the project details are valid.
                </span>
              )}
              {reportError && <span className="text-sm text-red-600">{reportError}</span>}
            </div>
            {exceeded.length > 0 && request && (
              <p className="text-sm text-red-700 mb-4">
                Tenability is exceeded before escape is complete in{' '}
                {exceeded.map((b) => b.name).join(', ')}. The report&apos;s conclusions will need rewriting.
              </p>
            )}

            {selected && selectedForm && (
              <>
                {evaluation.buildings.length > 1 && (
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{selected.name}</h3>
                )}

                {selected.outcome.state === 'incomplete' && (
                  <div className="border border-gray-200 rounded-xl p-8 text-center">
                    <p className="text-gray-600 text-sm">
                      {selected.outcome.missing.length > 0 && (
                        <>
                          Fill in{' '}
                          {selected.outcome.missing.map((f) => BUILDING_FIELD_LABELS[f]).join(', ').toLowerCase()}{' '}
                          to run the model.{' '}
                        </>
                      )}
                      {selected.outcome.invalid.length > 0 && (
                        <>
                          Check {selected.outcome.invalid.map((f) => BUILDING_FIELD_LABELS[f]).join(', ').toLowerCase()}.
                        </>
                      )}
                    </p>
                  </div>
                )}

                {selected.outcome.state === 'invalid' && (
                  <div className="border border-red-200 bg-red-50 rounded-xl p-5">
                    <p className="text-sm text-red-800">{selected.outcome.message}</p>
                  </div>
                )}

                {selected.outcome.state === 'ok' && (
                  <>
                    <ResultsSummary
                      results={selected.outcome.results}
                      assessmentTime={selected.outcome.inputs.assessmentTime}
                      tenabilityHeight={selected.outcome.inputs.tenabilityHeight}
                    />
                    <SmokeCharts
                      results={selected.outcome.results}
                      tenabilityHeight={selected.outcome.inputs.tenabilityHeight}
                    />
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
