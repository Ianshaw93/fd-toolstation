'use client';

import { Dispatch, useState } from 'react';
import type { DesignStagesRiba1to4 } from '../../lib/fee-types';
import { SERVICE_LABELS_1_4, SERVICES_WITH_MODELS, SERVICES_WITH_EXTENDED_TRAVEL } from '../../lib/fee-constants';
import ServiceRow from './ServiceRow';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  stages: DesignStagesRiba1to4;
  dispatch: Dispatch<any>;
}

const SERVICE_KEYS = Object.keys(SERVICE_LABELS_1_4) as (keyof DesignStagesRiba1to4)[];

export default function DesignStagesSection({ stages, dispatch }: Props) {
  const [confirmPeerReview, setConfirmPeerReview] = useState(false);

  const togglePeerReview = () => dispatch({ type: 'TOGGLE_SERVICE_1_4', key: 'peer_review' });

  // Enabling Peer Review clears every other RIBA 1–4 selection, so warn first
  // if the user has any of those stages ticked and would lose that progress.
  const handlePeerReviewToggle = () => {
    const enabling = !stages.peer_review.included;
    const hasOtherProgress = SERVICE_KEYS.some(
      (key) => key !== 'peer_review' && stages[key].included
    );
    if (enabling && hasOtherProgress) {
      setConfirmPeerReview(true);
    } else {
      togglePeerReview();
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 pr-3 text-xs font-medium text-gray-500 uppercase">Service</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase text-center">Included</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">Fee (£)</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase text-center">Optional</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase text-center">Limit Mtgs</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">Mtg #</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">End Date</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">Models</th>
            <th className="py-2 px-2 text-xs font-medium text-gray-500 uppercase text-center">Ext. Travel</th>
          </tr>
        </thead>
        <tbody>
          {SERVICE_KEYS.map((key) => (
            <ServiceRow
              key={key}
              serviceKey={key}
              label={SERVICE_LABELS_1_4[key]}
              config={stages[key]}
              dispatchType="SET_SERVICE_1_4"
              toggleType="TOGGLE_SERVICE_1_4"
              dispatch={dispatch}
              onToggle={key === 'peer_review' ? handlePeerReviewToggle : undefined}
            />
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={confirmPeerReview}
        title="Switch to Peer Review?"
        message="Peer Review can't be combined with the other RIBA Stage 1–4 services. Enabling it will clear all of your current Stage 1–4 selections and fees. Do you want to continue?"
        confirmLabel="Clear and enable Peer Review"
        cancelLabel="Keep my selections"
        onConfirm={() => {
          togglePeerReview();
          setConfirmPeerReview(false);
        }}
        onCancel={() => setConfirmPeerReview(false)}
      />
    </div>
  );
}
