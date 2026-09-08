'use client';

import { Dispatch, useState } from 'react';
import type { ServiceConfig, DesignStagesRiba1to4, DesignStagesRiba5, DesignStagesRiba6 } from '../../lib/fee-types';
import ServiceCard from './ServiceCard';
import ConfirmDialog from '../fee-proposal/ConfirmDialog';

// A stage group (RIBA 1-4, 5 or 6) as a stack of ServiceCards. Carries the same
// Peer Review guard as the web tool's DesignStagesSection.

interface Props {
  stages: DesignStagesRiba1to4 | DesignStagesRiba5 | DesignStagesRiba6;
  labels: Record<string, string>;
  dispatchType: string;
  toggleType: string;
  // Same loose typing as the web tool's ServiceRow: the action shape is decided by dispatchType.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: Dispatch<any>;
}

export default function StageCards({ stages: stageGroup, labels, dispatchType, toggleType, dispatch }: Props) {
  const stages = stageGroup as unknown as Record<string, ServiceConfig>;
  const keys = Object.keys(labels);
  const [confirmPeerReview, setConfirmPeerReview] = useState(false);

  const togglePeerReview = () => dispatch({ type: toggleType, key: 'peer_review' });
  const handlePeerReviewToggle = () => {
    const enabling = !stages.peer_review.included;
    const hasOtherProgress = keys.some((k) => k !== 'peer_review' && stages[k].included);
    if (enabling && hasOtherProgress) setConfirmPeerReview(true);
    else togglePeerReview();
  };

  return (
    <div className="space-y-1.5">
      {keys.map((key) => (
        <ServiceCard
          key={key}
          serviceKey={key}
          label={labels[key]}
          config={stages[key]}
          dispatchType={dispatchType}
          toggleType={toggleType}
          dispatch={dispatch}
          onToggle={key === 'peer_review' && 'peer_review' in stages ? handlePeerReviewToggle : undefined}
        />
      ))}

      {'peer_review' in stages && (
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
      )}
    </div>
  );
}
