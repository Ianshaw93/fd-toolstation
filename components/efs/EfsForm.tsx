'use client';

import { useState } from 'react';
import CollapsibleSection from '../fee-proposal/CollapsibleSection';
import ElevationTable from './ElevationTable';
import ResultsTable from './ResultsTable';
import { calculateEfs } from '../../lib/efs-api';
import type { Elevation, ElevationResult } from '../../lib/efs-types';

const MAX_ELEVATIONS = 10;

function createEmptyElevation(): Elevation {
  return { boundary_distance: '', height: '', width: '', has_suppression: false };
}

export default function EfsForm() {
  const [numElevations, setNumElevations] = useState(4);
  const [isCommercial, setIsCommercial] = useState(true);
  const [elevations, setElevations] = useState<Elevation[]>(
    Array.from({ length: MAX_ELEVATIONS }, createEmptyElevation)
  );
  const [results, setResults] = useState<ElevationResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleElevationChange = (index: number, field: keyof Elevation, value: number | '' | boolean) => {
    setElevations((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCalculate = async () => {
    setError(null);

    const activeElevations = elevations.slice(0, numElevations);
    const incomplete = activeElevations.some(
      (e) => e.boundary_distance === '' || e.height === '' || e.width === ''
    );
    if (incomplete) {
      setError('Please fill in all fields for each active elevation.');
      return;
    }

    setIsCalculating(true);
    try {
      const response = await calculateEfs({
        elevations: activeElevations.map((e) => ({
          boundary_distance: e.boundary_distance as number,
          height: e.height as number,
          width: e.width as number,
          has_suppression: e.has_suppression,
        })),
        is_commercial: isCommercial,
      });
      setResults(response.elevations);
    } catch (err: any) {
      setError(err.message || 'Calculation failed');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="pb-24">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <CollapsibleSection title="Building Type" defaultOpen={true}>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Building Use:</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsCommercial(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isCommercial
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Commercial
            </button>
            <button
              type="button"
              onClick={() => setIsCommercial(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !isCommercial
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Residential
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Elevation Data" defaultOpen={true}>
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm font-medium text-gray-700">Number of Elevations:</label>
          <select
            value={numElevations}
            onChange={(e) => setNumElevations(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          >
            {Array.from({ length: MAX_ELEVATIONS }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
        <ElevationTable
          elevations={elevations}
          numElevations={numElevations}
          onChange={handleElevationChange}
        />
      </CollapsibleSection>

      {results.length > 0 && (
        <CollapsibleSection title="Results" defaultOpen={true}>
          <ResultsTable results={results} />
        </CollapsibleSection>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {numElevations} elevation{numElevations !== 1 ? 's' : ''} &middot; {isCommercial ? 'Commercial' : 'Residential'}
          </span>
          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="px-6 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {isCalculating ? 'Calculating...' : 'Calculate'}
          </button>
        </div>
      </div>
    </div>
  );
}
