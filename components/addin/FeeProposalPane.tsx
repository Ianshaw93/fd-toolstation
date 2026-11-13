'use client';

import { useEffect, useRef, useState } from 'react';

import { useFeeProposal } from '../../hooks/useFeeProposal';
import type { Engineer } from '../../lib/fee-types';
import { fetchEngineersViaProxy, renderFeeProposal } from '../../lib/word-addin-api';
import { buildFeeProposalFilename } from '../../lib/fee-proposal-filename';
import {
  applySuggestedDocumentTitle,
  createNamedFeeProposalDocument,
  isSetSupported,
  newDocumentFromBase64,
  wordDocumentUrl,
  type NamedProposalResult,
} from '../../lib/word-ops';
import SuggestedFilename from './SuggestedFilename';
import CollapsibleSection from '../fee-proposal/CollapsibleSection';
import ClientDetailsSection from '../fee-proposal/ClientDetailsSection';
import ProjectDetailsSection from '../fee-proposal/ProjectDetailsSection';
import FeeOptionsSection from '../fee-proposal/FeeOptionsSection';
import StageCards from './StageCards';
import SynergyProjectPicker from './SynergyProjectPicker';
import { SERVICE_LABELS_1_4, SERVICE_LABELS_5, SERVICE_LABELS_6 } from '../../lib/fee-constants';
import { outcomeNotice, pollFeeProposalPrefill } from '../../lib/directory-prefill';
import type { FdSignIn } from '../../lib/fd-msal';
import { fetchFeeProposalPrefill } from '../../lib/synergy-api';
import type { DirectoryProject } from '../../lib/vendor/fd-directory-client';
import { engineerForAccount } from '../../lib/engineer-identity';
import { fieldProvenance, provenanceAnnouncement } from '../../lib/field-provenance';

// The fee proposal inside Word: the same form as the web tool, and Generate opens the
// letter as a new Word document instead of downloading a file. The stage tables are
// replaced by stacked cards (StageCards) because the pane is 320 px wide by default.

interface Props {
  inWord: boolean;
  busy: string | null;
  run: (label: string, fn: () => Promise<string | void>) => Promise<void>;
  signIn?: FdSignIn;
}

export default function FeeProposalPane({ inWord, busy, run, signIn }: Props) {
  const { state, dispatch, totalFee, buildRequest } = useFeeProposal();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [linkedNaming, setLinkedNaming] = useState<{ numberFormatted: string | null; name: string | null } | null>(null);
  const lookup = useRef<AbortController | null>(null);
  const suggestedFilename =
    state.synergy_project_ref && linkedNaming
      ? buildFeeProposalFilename({
          numberFormatted: linkedNaming.numberFormatted,
          projectName: linkedNaming.name,
        })
      : null;
  const [customFilename, setCustomFilename] = useState<string>('');
  const [isCustomFilename, setIsCustomFilename] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<NamedProposalResult | null>(null);

  useEffect(() => {
    if (!isCustomFilename && suggestedFilename) {
      setCustomFilename(suggestedFilename);
    }
  }, [suggestedFilename, isCustomFilename]);

  const activeFilename = (isCustomFilename ? customFilename : (suggestedFilename ?? customFilename)).trim();
  // null outside Word, false for a document that has never been saved, true once it has a URL.
  const [documentSaved, setDocumentSaved] = useState<boolean | null>(null);

  useEffect(() => {
    fetchEngineersViaProxy().then(setEngineers).catch(() => setEngineers([]));
    return () => lookup.current?.abort();
  }, []);

  const provenance = fieldProvenance(state);
  const pendingReview = Object.keys(state.directory_proposals).length;
  const announcement = [
    provenanceAnnouncement(provenance),
    pendingReview ? `${pendingReview} field${pendingReview > 1 ? 's have' : ' has'} a different value in Total Synergy to review.` : '',
  ].filter(Boolean).join(' ');
  const account = signIn?.state === 'signed_in' ? signIn.account : null;
  const accountEngineer = engineerForAccount(account, engineers);
  // Waits for the engineer list, so a signed-in person on the list is never treated as unknown.
  const engineersReady = engineers.length > 0;
  const accountKey = account?.key ?? null;
  useEffect(() => {
    if (accountKey && !engineersReady) return;
    dispatch({ type: 'APPLY_ACCOUNT_ENGINEER', accountKey, engineer: accountEngineer });
  }, [accountKey, accountEngineer, engineersReady, dispatch]);

  useEffect(() => {
    if (!inWord) {
      setDocumentSaved(null);
      return;
    }
    const url = wordDocumentUrl();
    setDocumentSaved(url === null ? null : url.trim().length > 0);
  }, [inWord, suggestedFilename]);

  // Set the document Title when the link changes or filename is edited. A saved file cannot be renamed from
  // Office.js; the suggested name stays in the card so it can be copied.
  useEffect(() => {
    if (!inWord || !activeFilename) return;
    void applySuggestedDocumentTitle(activeFilename).catch(() => undefined);
  }, [inWord, activeFilename]);

  const linkProject = (project: DirectoryProject) => {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    const ref = project.id;
    setLinkedNaming({ numberFormatted: project.numberFormatted, name: project.name });
    dispatch({ type: 'LINK_DIRECTORY_PROJECT', project });
    void pollFeeProposalPrefill(ref, {
      fetchPrefill: fetchFeeProposalPrefill,
      signal: controller.signal,
      onResponse: (prefill) => dispatch({ type: 'APPLY_DIRECTORY_PREFILL', prefill }),
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
      setGenerationResult(null);
      const b64 = await renderFeeProposal(buildRequest(), {
        user_email: account?.username ?? null,
        user_name: account?.name ?? null,
        synergy_project_ref: state.synergy_project_ref,
        synergy_project_label: state.project.synergy_project_label ?? state.last_project_label ?? null,
        suggested_filename: suggestedFilename,
        active_filename: activeFilename || null,
        prefill_statuses: state.prefill_statuses,
        provenance,
        directory_applied: state.directory_applied,
        directory_proposals: state.directory_proposals,
        directory_declined: state.directory_declined,
        directory_review: state.directory_review,
        carried_from: state.carried_from,
        client_role_notice: state.client_role_notice,
      });
      const filenameToSave = activeFilename || suggestedFilename;
      if (filenameToSave) {
        const outcome = await createNamedFeeProposalDocument(filenameToSave, b64);
        setGenerationResult(outcome);
        if (outcome.saved) {
          return `Saved as ${outcome.filename}. Move it to the project folder (e.g. Dropbox).`;
        }
        return 'Fee proposal opened as a new document.';
      }
      await newDocumentFromBase64(b64);
      return 'Fee proposal opened as a new document.';
    });

  return (
    <div className="space-y-3">
      <SynergyProjectPicker
        selectedRef={state.synergy_project_ref}
        selectedLabel={state.project.synergy_project_label}
        signIn={signIn}
        onSelect={linkProject}
        onUnlink={() => {
          lookup.current?.abort();
          setLinkedNaming(null);
          setCustomFilename('');
          setIsCustomFilename(false);
          setGenerationResult(null);
          dispatch({ type: 'UNLINK_SYNERGY_PROJECT' });
        }}
        linkedDetail={
          suggestedFilename ? (
            <SuggestedFilename
              filename={isCustomFilename ? customFilename : suggestedFilename}
              suggestedFilename={suggestedFilename}
              onChange={(val) => {
                setCustomFilename(val);
                setIsCustomFilename(true);
              }}
              onReset={() => {
                setIsCustomFilename(false);
                if (suggestedFilename) setCustomFilename(suggestedFilename);
              }}
              documentSaved={documentSaved}
              savedResult={generationResult}
            />
          ) : null
        }
      />
      <p data-testid="autofill-announcement" className="sr-only" aria-live="polite">{announcement}</p>

      <CollapsibleSection title="Client Details" dense defaultOpen={true}>
        {state.client_role_notice && (
          <p className="mb-3 text-xs text-gray-600" role="status">{state.client_role_notice}</p>
        )}
        <ClientDetailsSection
          client={state.client}
          dispatch={dispatch}
          showCompany
          contactSuggestions={state.contact_suggestions}
          provenance={provenance}
          proposals={state.directory_proposals}
        />
      </CollapsibleSection>
      <CollapsibleSection title="Project Details" dense defaultOpen={true}>
        <ProjectDetailsSection project={state.project} dispatch={dispatch} provenance={provenance} proposals={state.directory_proposals} />
      </CollapsibleSection>
      <CollapsibleSection title="Fee Options" dense defaultOpen={true}>
        <FeeOptionsSection feeOptions={state.fee_options} engineers={engineers} dispatch={dispatch} provenance={provenance} />
        {account && engineersReady && !accountEngineer && !state.fee_options.engineer_name && (
          <p className="mt-2 text-xs text-gray-600">
            {account.name || account.username} is not on the engineer list, so no engineer was chosen. Pick one above.
          </p>
        )}
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

