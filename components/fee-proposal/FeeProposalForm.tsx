'use client';

import { useState, useEffect } from 'react';
import { useFeeProposal } from '../../hooks/useFeeProposal';
import { fetchEngineers, generateProposal } from '../../lib/fee-api';
import type { Engineer } from '../../lib/fee-types';
import CollapsibleSection from './CollapsibleSection';
import ClientDetailsSection from './ClientDetailsSection';
import ProjectDetailsSection from './ProjectDetailsSection';
import FeeOptionsSection from './FeeOptionsSection';
import DesignStagesSection from './DesignStagesSection';
import ConstructionStagesSection from './ConstructionStagesSection';
import CompletionStagesSection from './CompletionStagesSection';
import FeeSummaryBar from './FeeSummaryBar';

export default function FeeProposalForm() {
  const { state, dispatch, totalFee, buildRequest } = useFeeProposal();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEngineers()
      .then(setEngineers)
      .catch((err) => setError(`Failed to load engineers: ${err.message}`));
  }, []);

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const request = buildRequest();
      await generateProposal(request);
    } catch (err: any) {
      setError(err.message || 'Failed to generate proposal');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="pb-24">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <CollapsibleSection title="Client Details" defaultOpen={true}>
        <ClientDetailsSection client={state.client} dispatch={dispatch} />
      </CollapsibleSection>

      <CollapsibleSection title="Project Details" defaultOpen={true}>
        <ProjectDetailsSection project={state.project} dispatch={dispatch} />
      </CollapsibleSection>

      <CollapsibleSection title="Fee Options" defaultOpen={true}>
        <FeeOptionsSection
          feeOptions={state.fee_options}
          engineers={engineers}
          dispatch={dispatch}
        />
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

      <FeeSummaryBar
        totalFee={totalFee}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />
    </div>
  );
}
