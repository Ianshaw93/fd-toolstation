'use client';

import type { BuildingEvaluation } from '../../lib/smoke-layer-project';

interface BuildingsSummaryTableProps {
  buildings: BuildingEvaluation[];
  selectedId: string;
  onSelect: (id: string) => void;
  assessmentTime: number | null;
}

function seconds(value: number): string {
  return `${Math.round(value).toLocaleString('en-GB')} s`;
}

/** One row per building; clicking a row shows that building's charts below. */
export default function BuildingsSummaryTable({
  buildings,
  selectedId,
  onSelect,
  assessmentTime,
}: BuildingsSummaryTableProps) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-x-auto mb-4">
      <table className="w-full text-sm">
        <caption className="sr-only">ASET/RSET summary for each building</caption>
        <thead className="bg-gray-50">
          <tr className="text-left text-gray-700">
            <th scope="col" className="px-4 py-2 font-medium">Building</th>
            <th scope="col" className="px-4 py-2 font-medium">RSET</th>
            <th scope="col" className="px-4 py-2 font-medium">ASET</th>
            <th scope="col" className="px-4 py-2 font-medium">Margin</th>
            <th scope="col" className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {buildings.map((b) => {
            const selected = b.id === selectedId;
            const rowClass = `border-t border-gray-100 cursor-pointer ${selected ? 'bg-gray-100' : 'hover:bg-gray-50'}`;
            if (b.outcome.state !== 'ok') {
              return (
                <tr key={b.id} className={rowClass} onClick={() => onSelect(b.id)} aria-selected={selected}>
                  <td className="px-4 py-2 font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-2 text-gray-400" colSpan={3}>
                    {b.outcome.state === 'invalid' ? b.outcome.message : 'Incomplete'}
                  </td>
                  <td className="px-4 py-2 text-gray-500">—</td>
                </tr>
              );
            }
            const { results } = b.outcome;
            const safe = results.marginOfSafety > 0;
            const aset = results.asetTriggered
              ? seconds(results.aset)
              : `> ${seconds(assessmentTime ?? results.aset)}`;
            return (
              <tr key={b.id} className={rowClass} onClick={() => onSelect(b.id)} aria-selected={selected}>
                <td className="px-4 py-2 font-medium text-gray-900">{b.name}</td>
                <td className="px-4 py-2 tabular-nums text-gray-700">{seconds(results.rset)}</td>
                <td className="px-4 py-2 tabular-nums text-gray-700">{aset}</td>
                <td className={`px-4 py-2 tabular-nums font-medium ${safe ? 'text-green-800' : 'text-red-800'}`}>
                  {safe ? '+' : ''}
                  {Math.round(results.marginOfSafety).toLocaleString('en-GB')} s
                  {!results.asetTriggered && safe ? ' (at least)' : ''}
                </td>
                <td className={`px-4 py-2 ${safe ? 'text-green-800' : 'text-red-800'}`}>
                  {safe ? 'Tenability maintained' : 'Tenability exceeded'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
