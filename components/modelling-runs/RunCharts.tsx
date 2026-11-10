'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Data } from 'plotly.js';
import { messageFrom, MODELLING_POLL_MS, postJson } from '../../lib/modelling-runs/client';
import {
  buildDevcTraces,
  buildHrrTraces,
  plotConfig,
  timeSeriesLayout,
} from '../../lib/modelling-runs/plotly-charts';
import {
  applySeriesPayload,
  deviceMatches,
  emptySeriesView,
  parseSelectedDevc,
  parseSeriesPayload,
  seriesPath,
  type SeriesView,
} from '../../lib/modelling-runs/series';

function PlotlyPane({
  label,
  traces,
  xLabel,
  yLabel,
}: {
  label: string;
  traces: Data[];
  xLabel: string;
  yLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => timeSeriesLayout(xLabel, yLabel), [xLabel, yLabel]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !ref.current) return;
      await Plotly.react(ref.current, traces, layout, plotConfig);
    })();
    return () => {
      cancelled = true;
      void import('plotly.js-dist-min').then((mod) => {
        mod.default.purge(node);
      });
    };
  }, [traces, layout]);

  return (
    <figure role="img" aria-label={label} className="m-0">
      <div ref={ref} className="h-72 w-full" />
    </figure>
  );
}

export default function RunCharts({ runId }: { runId: string }) {
  const [view, setView] = useState<SeriesView>(emptySeriesView());
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    let cursor: string | null = null;
    let inFlight = false;

    async function tick(mode: 'replace' | 'append') {
      if (inFlight) return;
      inFlight = true;
      const url = seriesPath(runId, { after: mode === 'append' ? cursor : null });
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(messageFrom(body) || `Request failed (${res.status})`);
        const parsed = parseSeriesPayload(body);
        if (!active) return;
        cursor = parsed.cursor;
        setView((prev) => applySeriesPayload(prev, parsed, mode));
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Charts are unavailable');
      } finally {
        inFlight = false;
      }
    }

    void tick('replace');
    const id = setInterval(() => tick('append'), MODELLING_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [runId, selectedId]);

  async function choose(id: string) {
    setSaving(true);
    setError(null);
    try {
      const body = await postJson(`/api/cfd-dashboard/runs/${encodeURIComponent(runId)}/series`, {
        selected_devc: [id],
      });
      const saved = parseSelectedDevc(body);
      if (saved.length === 0) throw new Error('Device was not saved');
      setSelectedId(saved[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Device was not saved');
    } finally {
      setSaving(false);
    }
  }

  const matches = useMemo(
    () => view.devices.filter((device) => deviceMatches(device, query)),
    [view.devices, query],
  );
  const chartedId = view.selectedDevc[0] ?? null;
  const selected = view.devices.find((device) => device.id === chartedId) ?? null;
  const selectedPoints = chartedId ? (view.devc[chartedId] ?? []) : [];

  const hrrTraces = useMemo(() => buildHrrTraces(view.hrr, view.design), [view.hrr, view.design]);
  const devcTraces = useMemo(
    () => (selected ? buildDevcTraces(selected.quantity, selectedPoints) : []),
    [selected, selectedPoints],
  );
  const devcYLabel = selected?.unit ? `${selected.quantity} (${selected.unit})` : (selected?.quantity ?? '');

  const ready = view.cursor !== null;

  return (
    <section aria-label="Charts" className="mb-8 space-y-4">
      {ready ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Heat release rate</h3>
          <PlotlyPane
            label={`Heat release rate: ${view.hrrUnit} against Time (s)`}
            traces={hrrTraces}
            xLabel="Time (s)"
            yLabel={view.hrrUnit}
          />
          <p className="mt-2 text-sm text-gray-600">
            {view.hrr.length > 0 ? `${view.hrr.length} HRR samples` : 'No HRR samples yet'}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Loading charts…</p>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">Devices</h2>
        <input
          type="search"
          aria-label="Search devices"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by id or quantity"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <ul
          role="listbox"
          aria-label="Devices"
          className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200"
        >
          {matches.map((device) => (
            <li key={device.id}>
              <button
                type="button"
                role="option"
                aria-selected={device.id === chartedId}
                disabled={saving}
                onClick={() => choose(device.id)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-60 ${
                  device.id === chartedId ? 'bg-blue-50' : ''
                }`}
              >
                <span className="font-medium text-gray-900">{device.id}</span>
                <span className="text-gray-500">{device.quantity}</span>
              </button>
            </li>
          ))}
        </ul>
        {ready && matches.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No devices match.</p>
        ) : null}
        {selected ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-900">{selected.id}</h3>
            <PlotlyPane
              label={`${selected.id}: ${devcYLabel} against Time (s)`}
              traces={devcTraces}
              xLabel="Time (s)"
              yLabel={devcYLabel}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            Select a device to plot it. The choice is saved for the runner, which then sends that column only.
          </p>
        )}
      </div>

      {error ? (
        <p role="status" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
