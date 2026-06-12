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
import ManageWordingDrawer from './ManageWordingDrawer';
import FeeSummaryBar from './FeeSummaryBar';

export default function FeeProposalForm() {
  const { state, dispatch, totalFee, buildRequest } = useFeeProposal();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposal');
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

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Manage standard wording
        </button>
      </div>

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

      {/* The fixed create-report bar is irrelevant while managing wording, and
          would otherwise overlap the bottom of the drawer. */}
      {!manageOpen && (
        <FeeSummaryBar
          totalFee={totalFee}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />
      )}

      <ManageWordingDrawer open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}
