'use client';

import type { Elevation } from '../../lib/efs-types';

interface ElevationTableProps {
  elevations: Elevation[];
  numElevations: number;
  onChange: (index: number, field: keyof Elevation, value: number | '' | boolean) => void;
}

export default function ElevationTable({ elevations, numElevations, onChange }: ElevationTableProps) {
  const handleNumberChange = (index: number, field: 'boundary_distance' | 'height' | 'width', value: string) => {
    if (value === '') {
      onChange(index, field, '');
    } else {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        onChange(index, field, num);
      }
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 pr-4 font-medium text-gray-700 whitespace-nowrap">Parameter</th>
            {Array.from({ length: numElevations }, (_, i) => (
              <th key={i} className="py-3 px-2 font-medium text-gray-700 text-center min-w-[100px]">
                Elev. {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">Boundary Distance (m)</td>
            {Array.from({ length: numElevations }, (_, i) => (
              <td key={i} className="py-3 px-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={elevations[i].boundary_distance}
                  onChange={(e) => handleNumberChange(i, 'boundary_distance', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </td>
            ))}
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">ER Height (m)</td>
            {Array.from({ length: numElevations }, (_, i) => (
              <td key={i} className="py-3 px-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={elevations[i].height}
                  onChange={(e) => handleNumberChange(i, 'height', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </td>
            ))}
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">ER Width (m)</td>
            {Array.from({ length: numElevations }, (_, i) => (
              <td key={i} className="py-3 px-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={elevations[i].width}
                  onChange={(e) => handleNumberChange(i, 'width', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">Sprinkler Protected</td>
            {Array.from({ length: numElevations }, (_, i) => (
              <td key={i} className="py-3 px-2">
                <select
                  value={elevations[i].has_suppression ? 'Yes' : 'No'}
                  onChange={(e) => onChange(i, 'has_suppression', e.target.value === 'Yes')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
