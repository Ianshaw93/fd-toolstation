'use client';

import { useEffect, useRef, useState } from 'react';

import { useFeeProposal } from '../../hooks/useFeeProposal';
import type { Engineer } from '../../lib/fee-types';
import { fetchEngineersViaProxy, renderFeeProposal } from '../../lib/word-addin-api';
import { isSetSupported, newDocumentFromBase64 } from '../../lib/word-ops';
import CollapsibleSection from '../fee-proposal/CollapsibleSection';
import ClientDetailsSection from '../fee-proposal/ClientDetailsSection';
import ProjectDetailsSection from '../fee-proposal/ProjectDetailsSection';
import FeeOptionsSection from '../fee-proposal/FeeOptionsSection';
import StageCards from './StageCards';
import SynergyProjectPicker from './SynergyProjectPicker';
import { SERVICE_LABELS_1_4, SERVICE_LABELS_5, SERVICE_LABELS_6 } from '../../lib/fee-constants';
import {
  CLIENT_LOOKUP_TIMEOUT_NOTICE,
  pollFeeProposalPrefill,
  type PollOutcome,
} from '../../lib/directory-prefill';
import { fetchFeeProposalPrefill, type SynergyProjectHit } from '../../lib/synergy-api';

// The fee proposal inside Word: the same form as the web tool, and Generate opens the
// letter as a new Word document instead of downloading a file. The stage tables are
// replaced by stacked cards (StageCards) because the pane is 320 px wide by default.

interface Props {
  inWord: boolean;
  busy: string | null;
  run: (label: string, fn: () => Promise<string | void>) => Promise<void>;
}

export default function FeeProposalPane({ inWord, busy, run }: Props) {
  const { state, dispatch, totalFee, buildRequest } = useFeeProposal();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const linkGeneration = useRef(0);
  const lookup = useRef<AbortController | null>(null);
  const engineersRef = useRef(engineers);

  useEffect(() => {
    engineersRef.current = engineers;
  }, [engineers]);

  useEffect(() => {
    fetchEngineersViaProxy().then(setEngineers).catch(() => setEngineers([]));
    return () => lookup.current?.abort();
  }, []);

  const linkProject = (hit: SynergyProjectHit) => {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    const ref = hit.ref;
    dispatch({
      type: 'LINK_SYNERGY_PROJECT',
      synergy_project_id: hit.synergy_project_id,
      organisation_id: hit.organisation_id,
      label: hit.label,
      generation: ++linkGeneration.current,
      ref,
      project_name: hit.name ?? null,
      // The site address is not the client's address, so a hit location is not written.
      project_location: null,
    });
    void pollFeeProposalPrefill(ref, {
      fetchPrefill: fetchFeeProposalPrefill,
      signal: controller.signal,
      onResponse: (response) =>
        dispatch({
          type: 'APPLY_DIRECTORY_PREFILL',
          response,
          engineer_names: engineersRef.current.map((engineer) => engineer.full_name),
        }),
    }).then((outcome) => {
      const notice = outcomeNotice(outcome);
      if (notice && !controller.signal.aborted) dispatch({ type: 'SET_DIRECTORY_NOTICE', ref, notice });
    });
  };

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
      // The manifest no longer declares WordApi 1.3 (Exchange's validator rejects it), so
      // check here that this Word can open a generated document.
      if (!isSetSupported('WordApi', '1.3')) {
        throw new Error('This version of Word cannot open a generated document. Update Word (Microsoft 365) and try again.');
      }
      const b64 = await renderFeeProposal(buildRequest());
      await newDocumentFromBase64(b64);
      return 'Fee proposal opened as a new document.';
    });

  return (
    <div className="space-y-3">
      <SynergyProjectPicker
        selectedId={state.project.synergy_project_id}
        selectedOrgId={state.project.organisation_id}
        selectedLabel={state.project.synergy_project_label}
        onSelect={linkProject}
        onUnlink={() => {
          lookup.current?.abort();
          dispatch({ type: 'UNLINK_SYNERGY_PROJECT' });
        }}
      />
      {state.client_role_notice && (
        <p className="text-xs text-gray-600" role="status">{state.client_role_notice}</p>
      )}

      <CollapsibleSection title="Client Details" dense defaultOpen={true}>
        <ClientDetailsSection client={state.client} dispatch={dispatch} showCompany />
      </CollapsibleSection>
      <CollapsibleSection title="Project Details" dense defaultOpen={true}>
        <ProjectDetailsSection project={state.project} dispatch={dispatch} />
      </CollapsibleSection>
      <CollapsibleSection title="Fee Options" dense defaultOpen={true}>
        <FeeOptionsSection feeOptions={state.fee_options} engineers={engineers} dispatch={dispatch} />
      </CollapsibleSection>
      <CollapsibleSection title="Design Stages: RIBA 1-4" dense defaultOpen={true}>
        <StageCards
          stages={state.design_stages_1_4}
          labels={SERVICE_LABELS_1_4}
          dispatchType="SET_SERVICE_1_4"
          toggleType="TOGGLE_SERVICE_1_4"
          dispatch={dispatch}
        />
      </CollapsibleSection>
      <CollapsibleSection title="Construction Stages: RIBA 5" dense defaultOpen={false}>
        <StageCards
          stages={state.design_stages_5}
          labels={SERVICE_LABELS_5}
          dispatchType="SET_SERVICE_5"
          toggleType="TOGGLE_SERVICE_5"
          dispatch={dispatch}
        />
      </CollapsibleSection>
      <CollapsibleSection title="Completion: RIBA 6" dense defaultOpen={false}>
        <StageCards
          stages={state.design_stages_6}
          labels={SERVICE_LABELS_6}
          dispatchType="SET_SERVICE_6"
          toggleType="TOGGLE_SERVICE_6"
          dispatch={dispatch}
        />
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

function outcomeNotice(outcome: PollOutcome): string | null {
  switch (outcome.kind) {
    case 'timeout':
      return CLIENT_LOOKUP_TIMEOUT_NOTICE;
    case 'contract_mismatch':
      return 'The project directory answered in a format this pane does not read. Fill in the client details by hand.';
    case 'error':
      return outcome.message;
    default:
      return null;
  }
}
