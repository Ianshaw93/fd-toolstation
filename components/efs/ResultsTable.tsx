'use client';

import type { ElevationResult } from '../../lib/efs-types';

interface ResultsTableProps {
  results: ElevationResult[];
}

const RESULT_ROWS: { label: string; key: keyof ElevationResult }[] = [
  { label: 'Boundary Distance (m)', key: 'boundary_distance' },
  { label: 'ER Height (m)', key: 'er_height' },
  { label: 'ER Width (m)', key: 'er_width' },
  { label: 'BRE Height (m)', key: 'bre_height' },
  { label: 'BRE Width (m)', key: 'bre_width' },
  { label: 'BRE Unprotected %', key: 'bre_percentage' },
  { label: 'Allowable Unprotected Area (m\u00B2)', key: 'allowable_area' },
  { label: 'Actual ER Area (m\u00B2)', key: 'actual_area' },
  { label: 'Protected Area Required (m\u00B2)', key: 'actual_protected_area' },
  { label: 'Protected %', key: 'actual_percentage' },
];

export default function ResultsTable({ results }: ResultsTableProps) {
  if (results.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 pr-4 font-medium text-gray-700 whitespace-nowrap">Result</th>
            {results.map((r) => (
              <th key={r.elevation_number} className="py-3 px-2 font-medium text-gray-700 text-center min-w-[100px]">
                Elev. {r.elevation_number}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESULT_ROWS.map((row) => (
            <tr key={row.key} className="border-b border-gray-100">
              <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{row.label}</td>
              {results.map((r) => (
                <td key={r.elevation_number} className="py-3 px-2 text-center text-gray-900 font-mono">
                  {r[row.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
