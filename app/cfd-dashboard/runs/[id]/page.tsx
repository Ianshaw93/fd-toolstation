'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import RunDetailView from '../../../../components/modelling-runs/RunDetailView';

function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const raw = params.id;
  const runId = Array.isArray(raw) ? raw[0] : raw;

  return (
    <RunDetailView
      runId={runId}
      fromSearch={search.get('from') === 'search'}
      query={search.get('q') ?? ''}
      user={search.get('user') ?? ''}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">Loading run…</p>}>
      <RunDetailPage />
    </Suspense>
  );
}
