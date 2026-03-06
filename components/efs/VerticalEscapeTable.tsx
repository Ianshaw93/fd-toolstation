'use client';

import type { VerticalEscapeRow } from '../../lib/efs-types';
import { AREA_USE_TYPES } from '../../lib/efs-types';

const MAX_STAIRS = 20;

interface VerticalEscapeTableProps {
  rows: VerticalEscapeRow[];
  onChange: (rows: VerticalEscapeRow[]) => void;
}

function createEmptyRow(): VerticalEscapeRow {
  return { stairName: '', widthMm: '', numFloorsServed: '', useServed: '', singleStairAccess: false };
}

export function createInitialVerticalEscapeRows(): VerticalEscapeRow[] {
  return Array.from({ length: MAX_STAIRS }, createEmptyRow);
}

export default function VerticalEscapeTable({ rows, onChange }: VerticalEscapeTableProps) {
  const handleChange = (index: number, field: keyof VerticalEscapeRow, value: string | number | boolean) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleNumberChange = (index: number, field: 'widthMm' | 'numFloorsServed', value: string) => {
    if (value === '') {
      handleChange(index, field, '');
    } else {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        handleChange(index, field, num);
      }
    }
  };

  // Find last populated row to show a reasonable number
  let lastPopulated = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].stairName) {
      lastPopulated = i;
      break;
    }
  }
  const visibleRows = Math.min(MAX_STAIRS, Math.max(3, lastPopulated + 2));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 pr-2 font-medium text-gray-700 whitespace-nowrap w-8">#</th>
            <th className="text-left py-3 px-2 font-medium text-gray-700 whitespace-nowrap min-w-[180px]">Stair Name</th>
            <th className="text-center py-3 px-2 font-medium text-gray-700 whitespace-nowrap min-w-[110px]">Width (mm)</th>
            <th className="text-center py-3 px-2 font-medium text-gray-700 whitespace-nowrap min-w-[130px]">
              <span className="block">No. Floors Served</span>
              <span className="block text-xs font-normal text-gray-500">(Upper Storeys Only)</span>
            </th>
            <th className="text-center py-3 px-2 font-medium text-gray-700 whitespace-nowrap min-w-[160px]">
              <span className="block">Use Served</span>
              <span className="block text-xs font-normal text-gray-500">(Pick Most Onerous)</span>
            </th>
            <th className="text-center py-3 px-2 font-medium text-gray-700 whitespace-nowrap min-w-[130px]">Single Stair Access</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, visibleRows).map((row, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2 pr-2 text-gray-400 text-xs">{i + 1}</td>
              <td className="py-2 px-2">
                <input
                  type="text"
                  value={row.stairName}
                  onChange={(e) => handleChange(i, 'stairName', e.target.value)}
                  placeholder="e.g. Main Office Stair 1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </td>
              <td className="py-2 px-2">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={row.widthMm}
                  onChange={(e) => handleNumberChange(i, 'widthMm', e.target.value)}
                  placeholder="1000"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </td>
              <td className="py-2 px-2">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="10"
                  value={row.numFloorsServed}
                  onChange={(e) => handleNumberChange(i, 'numFloorsServed', e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </td>
              <td className="py-2 px-2">
                <select
                  value={row.useServed}
                  onChange={(e) => handleChange(i, 'useServed', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                >
                  <option value="">Select use...</option>
                  {AREA_USE_TYPES.map((use) => (
                    <option key={use} value={use}>{use}</option>
                  ))}
                </select>
              </td>
              <td className="py-2 px-2">
                <select
                  value={row.singleStairAccess ? 'Yes' : 'No'}
                  onChange={(e) => handleChange(i, 'singleStairAccess', e.target.value === 'Yes')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visibleRows < MAX_STAIRS && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          Showing {visibleRows} of {MAX_STAIRS} rows. Fill the last row to reveal more.
        </p>
      )}
    </div>
  );
}
