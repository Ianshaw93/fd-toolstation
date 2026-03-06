'use client';

import type { HorizontalEscapeRow } from '../../lib/efs-types';
import { AREA_USE_TYPES } from '../../lib/efs-types';

interface HorizontalEscapeSectionProps {
  rows: HorizontalEscapeRow[];
  numRows: number;
  numExitCols: number;
  onNumRowsChange: (n: number) => void;
  onNumExitColsChange: (n: number) => void;
  onChange: (index: number, field: string, value: string | number | '') => void;
  onExitWidthChange: (rowIndex: number, colIndex: number, value: number | '') => void;
}

const inputClass = 'w-full px-2 py-2 rounded-lg border border-gray-300 text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';

export default function HorizontalEscapeSection({
  rows, numRows, numExitCols, onNumRowsChange, onNumExitColsChange, onChange, onExitWidthChange,
}: HorizontalEscapeSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Number of Areas:</label>
          <select
            value={numRows}
            onChange={(e) => onNumRowsChange(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          >
            {Array.from({ length: 20 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Exit Columns:</label>
          <select
            value={numExitCols}
            onChange={(e) => onNumExitColsChange(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          >
            {Array.from({ length: 20 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 px-2 font-medium text-gray-700 text-center w-12">#</th>
              <th className="py-3 px-2 font-medium text-gray-700 text-left min-w-[180px]">Name</th>
              <th className="py-3 px-2 font-medium text-gray-700 text-left min-w-[180px]">Use</th>
              {Array.from({ length: numExitCols }, (_, i) => (
                <th key={i} className="py-3 px-1 font-medium text-gray-700 text-center min-w-[70px]">
                  Exit {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: numRows }, (_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-100">
                <td className="py-2 px-2 text-center text-gray-500">{rowIdx + 1}</td>
                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={rows[rowIdx].name}
                    onChange={(e) => onChange(rowIdx, 'name', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                </td>
                <td className="py-2 px-2">
                  <select
                    value={rows[rowIdx].use}
                    onChange={(e) => onChange(rowIdx, 'use', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    {AREA_USE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
                {Array.from({ length: numExitCols }, (_, colIdx) => (
                  <td key={colIdx} className="py-2 px-1">
                    <input
                      type="number"
                      value={rows[rowIdx].exitWidths[colIdx] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        onExitWidthChange(rowIdx, colIdx, v === '' ? '' : parseFloat(v));
                      }}
                      className={inputClass}
                      placeholder="mm"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-2">Leave exit width blank where not applicable.</p>
      </div>
    </div>
  );
}
