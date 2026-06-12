'use client';

import { useState } from 'react';
import CollapsibleSection from '../fee-proposal/CollapsibleSection';
import ProjectDetailsSection from './ProjectDetailsSection';
import BuildingOverviewSection from './BuildingOverviewSection';
import HorizontalEscapeSection from './HorizontalEscapeSection';
import VerticalEscapeTable, { createInitialVerticalEscapeRows } from './VerticalEscapeTable';
import InternalSpreadForm, { createInitialInternalSpreadData } from './InternalSpreadForm';
import ElevationTable from './ElevationTable';
import ResultsTable from './ResultsTable';
import { calculateEfs, generateEfsReport } from '../../lib/efs-api';
import type {
  ProjectDetails,
  BuildingOverview,
  HorizontalEscapeRow,
  VerticalEscapeRow,
  InternalSpreadData,
  Elevation,
  ElevationResult,
} from '../../lib/efs-types';

const MAX_ELEVATIONS = 10;
const MAX_ROWS = 20;
const MAX_EXIT_COLS = 20;

function createEmptyElevation(): Elevation {
  return { boundary_distance: '', height: '', width: '', has_suppression: false };
}

function createEmptyHorizontalRow(): HorizontalEscapeRow {
  return { name: '', use: '', exitWidths: Array(MAX_EXIT_COLS).fill('') };
}

export default function EfsForm() {
  // 1. Project Details
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    projectName: '', projectLocation: '', ribaDesignStage: '1', engineerName: '', clientName: '',
  });

  // 2. Building Overview
  const [buildingOverview, setBuildingOverview] = useState<BuildingOverview>({
    hasSuppression: false, suppressionStandard: 'BS EN 12845', fireAlarmCategory: 'L1',
    investigationPeriod: false, requiredFireResistance: '',
  });

  // 3. Horizontal Escape
  const [horizontalRows, setHorizontalRows] = useState<HorizontalEscapeRow[]>(
    Array.from({ length: MAX_ROWS }, createEmptyHorizontalRow)
  );
  const [numHorizontalRows, setNumHorizontalRows] = useState(6);
  const [numExitCols, setNumExitCols] = useState(6);

  // 4. Vertical Escape
  const [verticalEscapeRows, setVerticalEscapeRows] = useState<VerticalEscapeRow[]>(
    createInitialVerticalEscapeRows
  );

  // 5. Internal Fire Spread
  const [internalSpreadData, setInternalSpreadData] = useState<InternalSpreadData>(
    createInitialInternalSpreadData
  );

  // 6. External Fire Spread
  const [numElevations, setNumElevations] = useState(4);
  const [isCommercial, setIsCommercial] = useState(true);
  const [elevations, setElevations] = useState<Elevation[]>(
    Array.from({ length: MAX_ELEVATIONS }, createEmptyElevation)
  );
  const [results, setResults] = useState<ElevationResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProjectChange = (field: keyof ProjectDetails, value: string) => {
    setProjectDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleBuildingChange = (field: keyof BuildingOverview, value: string | boolean) => {
    setBuildingOverview((prev) => ({ ...prev, [field]: value }));
  };

  const handleHorizontalChange = (index: number, field: string, value: string | number | '') => {
    setHorizontalRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleExitWidthChange = (rowIndex: number, colIndex: number, value: number | '') => {
    setHorizontalRows((prev) => {
      const updated = [...prev];
      const widths = [...updated[rowIndex].exitWidths];
      widths[colIndex] = value;
      updated[rowIndex] = { ...updated[rowIndex], exitWidths: widths };
      return updated;
    });
  };

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleGenerateReport = async () => {
    setError(null);
    setIsGeneratingReport(true);
    try {
      const activeElevations = elevations.slice(0, numElevations);
      await generateEfsReport(
        {
          elevations: activeElevations.map((e) => ({
            boundary_distance: e.boundary_distance as number,
            height: e.height as number,
            width: e.width as number,
            has_suppression: e.has_suppression,
          })),
          is_commercial: isCommercial,
        },
        projectDetails.projectName || undefined,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
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

      <CollapsibleSection title="1. Project Details" defaultOpen={true}>
        <ProjectDetailsSection {...projectDetails} onChange={handleProjectChange} />
      </CollapsibleSection>

      <CollapsibleSection title="2. Building Overview" defaultOpen={true}>
        <BuildingOverviewSection data={buildingOverview} onChange={handleBuildingChange} />
      </CollapsibleSection>

      <CollapsibleSection title="3. Horizontal Means of Escape" defaultOpen={false}>
        <HorizontalEscapeSection
          rows={horizontalRows}
          numRows={numHorizontalRows}
          numExitCols={numExitCols}
          onNumRowsChange={setNumHorizontalRows}
          onNumExitColsChange={setNumExitCols}
          onChange={handleHorizontalChange}
          onExitWidthChange={handleExitWidthChange}
        />
      </CollapsibleSection>

      <CollapsibleSection title="4. Vertical Means of Escape" defaultOpen={false}>
        <VerticalEscapeTable rows={verticalEscapeRows} onChange={setVerticalEscapeRows} />
      </CollapsibleSection>

      <CollapsibleSection title="5. Internal Fire Spread" defaultOpen={false}>
        <InternalSpreadForm data={internalSpreadData} onChange={setInternalSpreadData} />
      </CollapsibleSection>

      <CollapsibleSection title="6. Building Type" defaultOpen={true}>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Building Use:</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsCommercial(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isCommercial ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Commercial
            </button>
            <button
              type="button"
              onClick={() => setIsCommercial(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !isCommercial ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Residential
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="7. External Fire Spread" defaultOpen={true}>
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm font-medium text-gray-700">Number of Elevations:</label>
          <select
            value={numElevations}
            onChange={(e) => setNumElevations(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          >
            {Array.from({ length: MAX_ELEVATIONS }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
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
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {isGeneratingReport ? 'Generating...' : 'Create Report'}
            </button>
          </div>
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
