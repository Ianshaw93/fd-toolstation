'use client';

import { TENABILITY_HEIGHT } from '../../lib/smoke-layer-types';
import type { SmokeLayerResults } from '../../lib/smoke-layer-types';

interface ResultsSummaryProps {
  results: SmokeLayerResults;
  assessmentTime: number;
  referenceHeight: number;
}

function seconds(value: number): string {
  return `${Math.round(value).toLocaleString('en-GB')} s`;
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-gray-200 rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold text-gray-900 mt-0.5">{value}</div>
      {note && <div className="text-xs text-gray-500 mt-0.5">{note}</div>}
    </div>
  );
}

export default function ResultsSummary({
  results,
  assessmentTime,
  referenceHeight,
}: ResultsSummaryProps) {
  const { rset, aset, asetTriggered, marginOfSafety, referenceHeightBreached, breachTime } = results;
  const safe = marginOfSafety > 0;

  return (
    <section aria-label="Results summary">
      <div
        className={`rounded-xl border p-5 ${
          safe ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
        }`}
      >
        <div className="flex items-center gap-2">
          {safe ? (
            <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z" />
            </svg>
          )}
          <span className={`text-sm font-semibold ${safe ? 'text-green-800' : 'text-red-800'}`}>
            {safe ? 'Tenability maintained' : 'Tenability limits exceeded'}
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className={`text-5xl font-semibold ${safe ? 'text-green-900' : 'text-red-900'}`}>
            {marginOfSafety > 0 ? '+' : ''}
            {Math.round(marginOfSafety).toLocaleString('en-GB')}
          </span>
          <span className="text-sm text-gray-600">
            seconds margin of safety{!asetTriggered && safe ? ' (at least)' : ''}
          </span>
        </div>

        <p className="text-sm text-gray-700 mt-3">
          {asetTriggered ? (
            <>
              The smoke layer reaches the {TENABILITY_HEIGHT} m tenability limit at{' '}
              <strong>{seconds(aset)}</strong>.{' '}
              {safe ? (
                <>Occupants are clear {seconds(marginOfSafety)} earlier.</>
              ) : (
                <>
                  This is {seconds(-marginOfSafety)} before escape is complete. The layer is at{' '}
                  {results.finalClearHeight.toFixed(2)} m 30 s after ASET.
                </>
              )}
            </>
          ) : (
            <>
              The smoke layer does not reach {TENABILITY_HEIGHT} m within the{' '}
              {seconds(assessmentTime)} assessment period — it settles at{' '}
              <strong>{results.finalClearHeight.toFixed(2)} m</strong>. The margin of safety is at
              least {seconds(marginOfSafety)}.
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <StatTile
          label="ASET"
          value={asetTriggered ? seconds(aset) : `> ${seconds(assessmentTime)}`}
          note={asetTriggered ? `Layer at ${TENABILITY_HEIGHT} m` : 'Never breached'}
        />
        <StatTile label="RSET" value={seconds(rset)} note={`${seconds(results.queueTime)} queuing`} />
        <StatTile
          label="Final clear height"
          value={`${results.finalClearHeight.toFixed(2)} m`}
          note={`From ${seconds(results.steps.length ? results.steps[results.steps.length - 1].time : 0)}`}
        />
        <StatTile
          label={`Reference height (${referenceHeight} m)`}
          value={referenceHeightBreached && breachTime !== null ? seconds(breachTime) : 'Not breached'}
          note={referenceHeightBreached ? 'Layer descends past it' : 'Within assessment time'}
        />
      </div>
    </section>
  );
}
