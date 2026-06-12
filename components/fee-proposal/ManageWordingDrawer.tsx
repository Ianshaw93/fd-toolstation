'use client';

import ManageTextBlockList from './ManageTextBlockList';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-out panel that brings the full standard-wording library into the
 * proposal builder, so editing permanent defaults no longer means leaving for a
 * separate app. Mounts its contents only while open (no fetch until needed).
 */
export default function ManageWordingDrawer({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Manage standard wording"
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Standard wording</h2>
            <p className="mt-1 text-sm text-gray-600">
              Edit the defaults used in <strong>all future proposals</strong>. Every change is
              recorded and can be reverted.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4">
          <ManageTextBlockList />
        </div>
      </aside>
    </div>
  );
}
