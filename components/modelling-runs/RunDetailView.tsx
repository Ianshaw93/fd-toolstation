'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ConfirmDialog from '../fee-proposal/ConfirmDialog';
import {
  formatProgress,
  formatTimestamp,
  logLines,
  messageFrom,
  MODELLING_POLL_MS,
  parseRunDetail,
  postJson,
  runDetailPath,
  safeResultsHref,
} from '../../lib/modelling-runs/client';
import type { ModellingRun } from '../../lib/modelling-runs/types';

export default function RunDetailView({
  runId,
  fromSearch,
  query,
  user,
}: {
  runId: string;
  fromSearch: boolean;
  query: string;
  user: string;
}) {
  const [run, setRun] = useState<ModellingRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let loggedOpen = false;

    async function tick() {
      const url = runDetailPath(
        runId,
        !loggedOpen && fromSearch ? { fromSearch: true, q: query, user } : undefined,
      );
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(messageFrom(body) || `Request failed (${res.status})`);
        if (!active) return;
        loggedOpen = true;
        setRun(parseRunDetail(body));
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        if (active) setLoading(false);
      }
    }

    tick();
    const id = setInterval(tick, MODELLING_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [runId, fromSearch, query, user]);

  async function confirmStop() {
    setConfirming(false);
    setBusy(true);
    setActionError(null);
    try {
      await postJson(`/api/cfd-dashboard/runs/${encodeURIComponent(runId)}/stop`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Stop failed');
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    setBusy(true);
    setActionError(null);
    try {
      await postJson(`/api/cfd-dashboard/runs/${encodeURIComponent(runId)}/restart`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Restart failed');
    } finally {
      setBusy(false);
    }
  }

  const resultsHref = safeResultsHref(run?.results_link);
  const lines = logLines(run?.events);
  const canStop = run?.status === 'queued' || run?.status === 'running';
  const canRestart = run != null && run.status !== 'queued';
  const progress = run?.progress_pct ?? 0;

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <div className="container mx-auto px-6 py-8 flex-1 max-w-4xl">
        <Link
          href="/cfd-dashboard"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          Back to runs
        </Link>
        {loading && !run ? <p className="text-gray-400">Loading run…</p> : null}
        {error ? (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {run ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{run.case_name}</h1>
                <p className="mt-2 text-sm text-gray-600">
                  {run.status} · {run.target}
                  {run.machine_name ? ` · ${run.machine_name}` : ''}
                </p>
              </div>
              <div className="flex gap-3">
                {canStop ? (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    disabled={busy}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Stop
                  </button>
                ) : null}
                {canRestart ? (
                  <button
                    type="button"
                    onClick={restart}
                    disabled={busy}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Restart
                  </button>
                ) : null}
              </div>
            </div>

            {actionError ? (
              <p role="alert" className="mb-4 text-sm text-red-700">
                {actionError}
              </p>
            ) : null}

            <section className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Progress</h2>
                <span className="text-2xl font-bold text-blue-600">{formatProgress(run.progress_pct)}</span>
              </div>
              <div
                role="progressbar"
                aria-label="Progress"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-full bg-gray-200 rounded-full h-4 overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Sim time {run.sim_time ?? '—'}s / {run.end_time ?? '—'}s
              </p>
              {run.error ? <p className="mt-2 text-sm text-red-700">{run.error}</p> : null}
              {resultsHref ? (
                <a
                  href={resultsHref}
                  className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
                  rel="noreferrer"
                >
                  Results
                </a>
              ) : null}
            </section>

            <section className="mb-8" aria-label="Cost">
              <h2 className="text-lg font-semibold mb-2">Cost</h2>
              <p className="text-sm text-gray-700">
                Estimate{' '}
                {run.cost_estimate == null ? (
                  '—'
                ) : (
                  <span>
                    {run.cost_estimate}
                    {run.cost_currency ? ` ${run.cost_currency}` : ''}
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-700">
                Actual {run.cost_actual == null ? '—' : `${run.cost_actual}${run.cost_currency ? ` ${run.cost_currency}` : ''}`}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-2">Recent log</h2>
              <pre
                aria-label="Recent log"
                className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs text-gray-100"
              >
                {lines.length > 0 ? lines.join('\n') : 'No log lines yet.'}
              </pre>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Events</h2>
              {(run.events ?? []).length === 0 ? (
                <p className="text-sm text-gray-400">No events yet.</p>
              ) : (
                <ul aria-label="Events" className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
                  {(run.events ?? []).map((event) => (
                    <li key={event.id} className="px-4 py-3 text-sm">
                      <span className="font-mono text-xs text-gray-500">{event.event_type}</span>
                      {event.message ? <span className="ml-2 text-gray-900">{event.message}</span> : null}
                      {event.created_at ? (
                        <time dateTime={event.created_at} className="mt-1 block text-xs text-gray-400">
                          {formatTimestamp(event.created_at)}
                        </time>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
      <footer className="bg-blue-300 text-white py-6 px-6">
        <div className="container mx-auto">
          <h2 className="text-2xl font-semibold mb-1">Fire Dynamics</h2>
          <p className="text-sm">&copy; 2022 Fire Dynamics Group Limited | Company number: 13476929</p>
        </div>
      </footer>
      <ConfirmDialog
        open={confirming}
        title="Stop this run?"
        message="The runner will stop this FDS process on the machine."
        confirmLabel="Stop run"
        onConfirm={confirmStop}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
