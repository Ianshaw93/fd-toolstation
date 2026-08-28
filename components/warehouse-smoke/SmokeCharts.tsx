'use client';

import { useMemo, useState } from 'react';

import LineChart, { type ChartMarker, type ChartThreshold } from './LineChart';
import { TENABILITY_HEIGHT } from '../../lib/smoke-layer-types';
import type { SmokeLayerResults } from '../../lib/smoke-layer-types';

/** Categorical slots 1 and 2 of the validated palette. */
const SERIES_1 = '#2a78d6';
const SERIES_2 = '#eb6834';

/** Rows to show in the data table before thinning it out. */
const TABLE_ROW_TARGET = 120;

interface SmokeChartsProps {
  results: SmokeLayerResults;
  referenceHeight: number;
}

const TABLE_COLUMNS: { key: keyof SmokeLayerResults['steps'][number]; label: string; decimals: number }[] = [
  { key: 'time', label: 'Time (s)', decimals: 1 },
  { key: 'hrr', label: 'Total HRR (MW)', decimals: 3 },
  { key: 'convectiveHrr', label: 'Convective HRR (MW)', decimals: 3 },
  { key: 'clearHeight', label: 'Clear height (m)', decimals: 3 },
  { key: 'smokeLayerTemp', label: 'Layer temp (°C)', decimals: 2 },
  { key: 'addedSmokeTemp', label: 'Incoming smoke temp (°C)', decimals: 2 },
  { key: 'velocity', label: 'Descent rate (m/s)', decimals: 5 },
  { key: 'escaped', label: 'Escaped', decimals: 0 },
];

function toCsv(results: SmokeLayerResults): string {
  const header = TABLE_COLUMNS.map((c) => c.label).join(',');
  const rows = results.steps.map((step) =>
    TABLE_COLUMNS.map((c) => step[c.key].toFixed(c.decimals)).join(','),
  );
  return [header, ...rows].join('\n');
}

export default function SmokeCharts({ results, referenceHeight }: SmokeChartsProps) {
  const [showTable, setShowTable] = useState(false);
  const { steps, aset, rset, asetTriggered } = results;

  const heightThresholds = useMemo(() => {
    const thresholds: ChartThreshold[] = [
      { value: TENABILITY_HEIGHT, label: `${TENABILITY_HEIGHT} m tenability` },
    ];
    if (referenceHeight !== TENABILITY_HEIGHT) {
      thresholds.push({ value: referenceHeight, label: `${referenceHeight} m reference` });
    }
    return thresholds;
  }, [referenceHeight]);

  const markers = useMemo(() => {
    const list: ChartMarker[] = [];
    if (asetTriggered) list.push({ value: aset, label: `ASET ${aset} s` });
    if (steps.length > 0 && rset <= steps[steps.length - 1].time) {
      list.push({ value: rset, label: `RSET ${rset} s` });
    }
    return list;
  }, [asetTriggered, aset, rset, steps]);

  const tableRows = useMemo(() => {
    const stride = Math.max(1, Math.ceil(steps.length / TABLE_ROW_TARGET));
    const rows = steps.filter((_, i) => i % stride === 0);
    const last = steps[steps.length - 1];
    if (last && rows[rows.length - 1] !== last) rows.push(last);
    return rows;
  }, [steps]);

  const csvHref = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(results))}`,
    [results],
  );

  return (
    <section aria-label="Charts" className="mt-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="xl:col-span-2">
          <LineChart
            title="Smoke layer height"
            data={steps as unknown as Record<string, number>[]}
            xKey="time"
            series={[{ key: 'clearHeight', label: 'Clear height', color: SERIES_1 }]}
            xLabel="Time (s)"
            xFromZero
            yLabel="Clear height (m)"
            thresholds={heightThresholds}
            markers={markers}
            yFromZero
            height={320}
            unit=" m"
          />
        </div>

        <LineChart
          title="Smoke layer temperature"
          data={steps as unknown as Record<string, number>[]}
          xKey="time"
          series={[
            { key: 'smokeLayerTemp', label: 'Layer (well mixed)', color: SERIES_1 },
            { key: 'addedSmokeTemp', label: 'Smoke entering layer', color: SERIES_2 },
          ]}
          xLabel="Time (s)"
          xFromZero
          yLabel="Temperature (°C)"
          markers={markers}
          unit=" °C"
          decimals={1}
        />

        <LineChart
          title="Heat release rate"
          data={steps as unknown as Record<string, number>[]}
          xKey="time"
          series={[
            { key: 'hrr', label: 'Total', color: SERIES_1 },
            { key: 'convectiveHrr', label: 'Convective', color: SERIES_2 },
          ]}
          xLabel="Time (s)"
          xFromZero
          yLabel="Heat release rate (MW)"
          yFromZero
          unit=" MW"
        />

        <LineChart
          title="Rate of descent of the layer"
          data={steps as unknown as Record<string, number>[]}
          xKey="time"
          series={[{ key: 'velocity', label: 'Descent rate', color: SERIES_1 }]}
          xLabel="Time (s)"
          xFromZero
          yLabel="Descent rate (m/s)"
          decimals={4}
          unit=" m/s"
        />

        <LineChart
          title="Occupants escaped"
          data={steps as unknown as Record<string, number>[]}
          xKey="time"
          series={[{ key: 'escaped', label: 'Escaped', color: SERIES_1 }]}
          xLabel="Time (s)"
          xFromZero
          yLabel="People"
          markers={markers}
          yFromZero
          decimals={0}
        />
      </div>

      <div className="flex items-center gap-4 mt-4">
        <button
          type="button"
          onClick={() => setShowTable((open) => !open)}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          {showTable ? 'Hide data table' : 'Show data table'}
        </button>
        <a
          href={csvHref}
          download="warehouse_smoke_layer.csv"
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          Download all {steps.length.toLocaleString('en-GB')} timesteps (CSV)
        </a>
      </div>

      {showTable && (
        <div className="mt-3 border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Smoke layer results by timestep, thinned to every{' '}
              {Math.max(1, Math.ceil(steps.length / TABLE_ROW_TARGET))} timestep.
            </caption>
            <thead className="bg-gray-50">
              <tr>
                {TABLE_COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className="text-left font-medium text-gray-700 px-3 py-2 whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.time} className="border-t border-gray-100">
                  {TABLE_COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-1.5 tabular-nums text-gray-700 whitespace-nowrap">
                      {row[c.key].toFixed(c.decimals)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
