'use client';

import { useEffect, useState } from 'react';

import { useFeeProposal, type FeeProposalSnapshot } from '../../hooks/useFeeProposal';
import type { Engineer } from '../../lib/fee-types';
import { fetchEngineersViaProxy, renderFeeProposal } from '../../lib/word-addin-api';
import {
  insertSectionAtCursor,
  listSectionTags,
  loadDocumentState,
  newDocumentFromBase64,
  regenerateSection,
  saveDocumentState,
  SECTION_TAG_PREFIX,
} from '../../lib/word-ops';
import CollapsibleSection from '../fee-proposal/CollapsibleSection';
import ClientDetailsSection from '../fee-proposal/ClientDetailsSection';
import ProjectDetailsSection from '../fee-proposal/ProjectDetailsSection';
import FeeOptionsSection from '../fee-proposal/FeeOptionsSection';
import DesignStagesSection from '../fee-proposal/DesignStagesSection';
import ConstructionStagesSection from '../fee-proposal/ConstructionStagesSection';
import CompletionStagesSection from '../fee-proposal/CompletionStagesSection';

// The fee proposal inside Word: the same form as the web tool, but the letter opens as a
// new document or lands at the cursor as a regenerable section. The form's state is
// stored in the document itself, so reopening the file brings it back and Regenerate
// re-renders from the current values.

export const FEE_SECTION_ID = 'fee-proposal';
const STATE_KEY = 'fee-proposal';

interface Props {
  inWord: boolean;
  busy: string | null;
  run: (label: string, fn: () => Promise<string | void>) => Promise<void>;
  /** Show the insert/regenerate experiments (dev pane only). */
  devTools?: boolean;
}

export default function FeeProposalPane({ inWord, busy, run, devTools = false }: Props) {
  const { state, dispatch, totalFee, buildRequest } = useFeeProposal();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [present, setPresent] = useState(false);
  const [restored, setRestored] = useState<string | null>(null);

  useEffect(() => {
    fetchEngineersViaProxy().then(setEngineers).catch(() => setEngineers([]));
  }, []);

  // On entering the tab inside Word: does this document already carry a fee proposal?
  useEffect(() => {
    if (!inWord) return;
    (async () => {
      try {
        const tags = await listSectionTags();
        setPresent(tags.includes(SECTION_TAG_PREFIX + FEE_SECTION_ID));
        const saved = await loadDocumentState<FeeProposalSnapshot>(STATE_KEY);
        if (saved) {
          dispatch({ type: 'HYDRATE', state: saved });
          setRestored(saved.project?.project_name || 'this document');
        }
      } catch {
        /* preview mode or an older host */
      }
    })();
  }, [inWord, dispatch]);

  const snapshot = (): FeeProposalSnapshot => JSON.parse(JSON.stringify(state));

  /** The generator's own preconditions, checked here so the message is plain. */
  const missing = (): string | null => {
    const gaps: string[] = [];
    if (!state.fee_options.engineer_name) gaps.push('an engineer (Fee Options)');
    if (!state.client.first_name.trim()) gaps.push("the client's first name");
    if (!state.project.project_name.trim()) gaps.push('a project name');
    return gaps.length ? `Fill in ${gaps.join(', ')} first.` : null;
  };

  const render = async (): Promise<string> => {
    const gap = missing();
    if (gap) throw new Error(gap);
    return renderFeeProposal(buildRequest());
  };

  const asNewDocument = () =>
    run('Generate', async () => {
      const b64 = await render();
      await newDocumentFromBase64(b64);
      return 'Fee proposal opened as a new document.';
    });

  const insertHere = () =>
    run('Insert fee proposal', async () => {
      const b64 = await render();
      await insertSectionAtCursor(b64, FEE_SECTION_ID, 'Fee proposal');
      await saveDocumentState(STATE_KEY, snapshot());
      setPresent(true);
      return 'Fee proposal inserted at the cursor and its inputs saved in the document.';
    });

  const regenerate = () =>
    run('Regenerate fee proposal', async () => {
      const b64 = await render();
      const ok = await regenerateSection(b64, FEE_SECTION_ID);
      if (!ok) return 'No fee proposal section found in this document; use Insert at cursor.';
      await saveDocumentState(STATE_KEY, snapshot());
      return 'Fee proposal regenerated in place from the current inputs.';
    });

  return (
    <div className="space-y-3">
      {restored && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
          Inputs restored from {restored}.
        </p>
      )}

      <CollapsibleSection title="Client Details" defaultOpen={true}>
        <ClientDetailsSection client={state.client} dispatch={dispatch} />
      </CollapsibleSection>
      <CollapsibleSection title="Project Details" defaultOpen={true}>
        <ProjectDetailsSection project={state.project} dispatch={dispatch} />
      </CollapsibleSection>
      <CollapsibleSection title="Fee Options" defaultOpen={true}>
        <FeeOptionsSection feeOptions={state.fee_options} engineers={engineers} dispatch={dispatch} />
      </CollapsibleSection>
      <CollapsibleSection title="Design Stages: RIBA 1-4" defaultOpen={true}>
        <DesignStagesSection stages={state.design_stages_1_4} dispatch={dispatch} />
      </CollapsibleSection>
      <CollapsibleSection title="Construction Stages: RIBA 5" defaultOpen={false}>
        <ConstructionStagesSection stages={state.design_stages_5} dispatch={dispatch} />
      </CollapsibleSection>
      <CollapsibleSection title="Completion: RIBA 6" defaultOpen={false}>
        <CompletionStagesSection stages={state.design_stages_6} dispatch={dispatch} />
      </CollapsibleSection>

      <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-2 pb-1 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-gray-500">Total fee</span>
          <span className="font-semibold">
            £{totalFee.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!inWord || !!busy}
            onClick={asNewDocument}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white font-medium disabled:opacity-40"
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
          {devTools && (
            <button
              disabled={!inWord || !!busy}
              onClick={insertHere}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
            >
              Insert at cursor
            </button>
          )}
          {present && devTools && (
            <button
              disabled={!inWord || !!busy}
              onClick={regenerate}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40"
            >
              Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
