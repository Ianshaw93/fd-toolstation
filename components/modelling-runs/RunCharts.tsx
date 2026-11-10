'use client';

import { useEffect, useMemo, useState } from 'react';
import LineChart, { type ChartSeries } from '../warehouse-smoke/LineChart';
import { messageFrom, MODELLING_POLL_MS } from '../../lib/modelling-runs/client';
import {
  applySeriesPayload,
  deviceMatches,
  emptySeriesView,
  parseSeriesPayload,
  seriesPath,
  type SeriesView,
} from '../../lib/modelling-runs/series';

/** Mid blue from the CFD report charts. */
const RECORDED_BLUE = '#4798EA';
/** Dotted design curve, same role as the programmed HRR line. */
const DESIGN_RED = '#E10600';

export default function RunCharts({ runId }: { runId: string }) {
  const [view, setView] = useState<SeriesView>(emptySeriesView());
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let cursor: string | null = null;
    let inFlight = false;
    const requested = selectedId ? [selectedId] : [];

    async function tick(mode: 'replace' | 'append') {
      if (inFlight) return;
      inFlight = true;
      const url = seriesPath(runId, {
        since: mode === 'append' ? cursor : null,
        devices: requested,
      });
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(messageFrom(body) || `Request failed (${res.status})`);
        const parsed = parseSeriesPayload(body);
        if (!active) return;
        cursor = parsed.cursor;
        setView((prev) => applySeriesPayload(prev, parsed, mode, requested));
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

  const matches = useMemo(
    () => view.devices.filter((device) => deviceMatches(device, query)),
    [view.devices, query],
  );
  const selected = view.devices.find((device) => device.id === selectedId) ?? null;
  const selectedPoints = selectedId ? (view.selected[selectedId] ?? []) : [];

  const hrrData = useMemo(
    () => view.hrr.map((point) => ({ t: point.t, hrr: point.v })),
    [view.hrr],
  );
  const hrrSeries = useMemo(() => {
    const series: ChartSeries[] = [{ key: 'hrr', label: 'Recorded HRR', color: RECORDED_BLUE }];
    if (view.design && view.design.length > 0) {
      series.push({
        key: 'design',
        label: 'Design HRR',
        color: DESIGN_RED,
        dash: '2 4',
        points: view.design.map((point) => ({ x: point.t, y: point.v })),
      });
    }
    return series;
  }, [view.design]);

  const devcData = useMemo(
    () => selectedPoints.map((point) => ({ t: point.t, v: point.v })),
    [selectedPoints],
  );

  const ready = view.cursor !== null;

  return (
    <section aria-label="Charts" className="mb-8 space-y-4">
      {ready ? (
        <div>
          <LineChart
            title="Heat release rate"
            data={hrrData}
            xKey="t"
            series={hrrSeries}
            xLabel="Time (s)"
            yLabel={view.hrrUnit}
            yFromZero
            xFromZero
            strokeWidth={1.75}
            decimals={1}
            unit={` ${view.hrrUnit}`}
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
                aria-selected={device.id === selectedId}
                onClick={() => setSelectedId(device.id)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  device.id === selectedId ? 'bg-blue-50' : ''
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
            <LineChart
              title={selected.id}
              data={devcData}
              xKey="t"
              series={[{ key: 'v', label: selected.quantity, color: RECORDED_BLUE }]}
              xLabel="Time (s)"
              yLabel={selected.unit ? `${selected.quantity} (${selected.unit})` : selected.quantity}
              yFromZero
              xFromZero
              strokeWidth={1.75}
              decimals={1}
              unit={selected.unit ? ` ${selected.unit}` : ''}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Select a device to plot it.</p>
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
