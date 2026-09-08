'use client';

import { useEffect, useState } from 'react';

import { useFeeProposal } from '../../hooks/useFeeProposal';
import type { Engineer } from '../../lib/fee-types';
import { fetchEngineersViaProxy, renderFeeProposal } from '../../lib/word-addin-api';
import { newDocumentFromBase64 } from '../../lib/word-ops';
import CollapsibleSection from '../fee-proposal/CollapsibleSection';
import ClientDetailsSection from '../fee-proposal/ClientDetailsSection';
import ProjectDetailsSection from '../fee-proposal/ProjectDetailsSection';
import FeeOptionsSection from '../fee-proposal/FeeOptionsSection';
import DesignStagesSection from '../fee-proposal/DesignStagesSection';
import ConstructionStagesSection from '../fee-proposal/ConstructionStagesSection';
import CompletionStagesSection from '../fee-proposal/CompletionStagesSection';

// The fee proposal inside Word: the same form as the web tool, and Generate opens the
// letter as a new Word document instead of downloading a file.

interface Props {
  inWord: boolean;
  busy: string | null;
  run: (label: string, fn: () => Promise<string | void>) => Promise<void>;
}

export default function FeeProposalPane({ inWord, busy, run }: Props) {
  const { state, dispatch, totalFee, buildRequest } = useFeeProposal();
  const [engineers, setEngineers] = useState<Engineer[]>([]);

  useEffect(() => {
    fetchEngineersViaProxy().then(setEngineers).catch(() => setEngineers([]));
  }, []);

  /** The generator's own preconditions, checked here so the message is plain. */
  const missing = (): string | null => {
    const gaps: string[] = [];
    if (!state.fee_options.engineer_name) gaps.push('an engineer (Fee Options)');
    if (!state.client.first_name.trim()) gaps.push("the client's first name");
    if (!state.project.project_name.trim()) gaps.push('a project name');
    return gaps.length ? `Fill in ${gaps.join(', ')} first.` : null;
  };

  const generate = () =>
    run('Generate', async () => {
      const gap = missing();
      if (gap) throw new Error(gap);
      const b64 = await renderFeeProposal(buildRequest());
      await newDocumentFromBase64(b64);
      return 'Fee proposal opened as a new document.';
    });

  return (
    <div className="space-y-3">
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

      <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-2 pb-1 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs text-gray-500">Total fee</span>
          <div className="font-semibold">
            £{totalFee.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <button
          disabled={!inWord || !!busy}
          onClick={generate}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white font-medium disabled:opacity-40"
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </div>
  );
}
