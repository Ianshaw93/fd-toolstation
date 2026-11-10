'use client';

import { useEffect, useState } from 'react';
import { fetchDashboardState, CfdDashboardState } from '../../lib/cfd-api';
import { MODELLING_POLL_MS } from '../../lib/modelling-runs/client';

function RunnerStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: 'bg-green-500',
    idle: 'bg-yellow-400',
    offline: 'bg-red-500',
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${colors[status] || colors.offline}`} />
      <span className="text-sm capitalize text-gray-600">{status}</span>
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function LegacyCfdPanels() {
  const [state, setState] = useState<CfdDashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const data = await fetchDashboardState();
        if (active) {
          setState(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to connect to server');
      }
    }

    poll();
    const interval = setInterval(poll, MODELLING_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="mt-12 border-t border-gray-200 pt-8" aria-label="Runner status">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Runner status</h2>
          <p className="text-gray-600 text-sm mt-1">The legacy single-machine view, through the same proxy.</p>
        </div>
        {state ? <RunnerStatusDot status={state.runner.status} /> : null}
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">{error}</div>
      ) : null}

      {!state && !error ? <div className="text-gray-400 text-center py-12">Loading...</div> : null}

      {state ? (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Currently Running</h2>
            {state.current ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-semibold text-gray-900 truncate">{state.current.name}</h3>
                  <span className="text-2xl font-bold text-blue-600">{(state.current.progress_pct ?? 0).toFixed(1)}%</span>
                </div>
                <ProgressBar percent={state.current.progress_pct ?? 0} />
                <div className="flex gap-6 mt-3 text-sm text-gray-500">
                  {state.current.machine_name ? <span className="font-mono">{state.current.machine_name}</span> : null}
                  <span>{state.current.meshes} meshes</span>
                  <span>T_END: {state.current.t_end}s</span>
                  <span>Elapsed: {formatDuration(state.current.started_at, null)}</span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-gray-400 text-center">
                No simulation running
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Queue{' '}
              {state.queue.length > 0 ? (
                <span className="text-gray-400 font-normal">({state.queue.length} pending)</span>
              ) : null}
            </h2>
            {state.queue.length > 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl divide-y divide-gray-200">
                {state.queue.map((sim, i) => (
                  <div key={sim.id} className="px-6 py-3 flex items-center gap-3">
                    <span className="text-gray-400 text-sm font-mono w-6">{i + 1}.</span>
                    <span className="text-gray-900">{sim.name}</span>
                    {sim.machine_name ? <span className="text-xs text-gray-400 font-mono">{sim.machine_name}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-gray-400 text-center">
                No simulations queued
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Completed</h2>
            {state.completed.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="pb-2 pr-4 font-medium">Name</th>
                      <th className="pb-2 pr-4 font-medium">Machine</th>
                      <th className="pb-2 pr-4 font-medium">Duration</th>
                      <th className="pb-2 font-medium">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {state.completed.map((sim) => (
                      <tr key={sim.id}>
                        <td className="py-2 pr-4 text-gray-900">{sim.name}</td>
                        <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{sim.machine_name || '-'}</td>
                        <td className="py-2 pr-4 text-gray-600">{formatDuration(sim.started_at, sim.completed_at)}</td>
                        <td className="py-2 text-gray-600">{formatDate(sim.completed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-gray-400 text-center">
                No completed simulations
              </div>
            )}
          </section>

          {state.errors.length > 0 ? (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Errors</h2>
              <div className="space-y-2">
                {state.errors.map((sim) => (
                  <div key={sim.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-red-800">{sim.name}</span>
                        {sim.machine_name ? <span className="text-xs text-red-400 font-mono">{sim.machine_name}</span> : null}
                      </div>
                      <span className="text-sm text-red-500">{formatDate(sim.updated_at)}</span>
                    </div>
                    {sim.error_msg ? <p className="text-sm text-red-600 mt-1">{sim.error_msg}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
