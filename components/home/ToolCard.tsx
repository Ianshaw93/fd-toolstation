'use client';

import type { CfdDashboardState } from '../../lib/cfd-api';
import { ctaLabel } from '../../lib/tools/catalogue';
import { isInternalUrl, resolveOpenUrl } from '../../lib/tools/search';
import type { ToolPart } from '../../lib/tools/types';

export function CfdBadge({ state }: { state: CfdDashboardState | null }) {
  if (!state) {
    return <span className="text-3xl">🖥️</span>;
  }

  const runnerStatus = state.runner.status;
  const statusColor =
    runnerStatus === 'online' ? 'bg-green-500' : runnerStatus === 'idle' ? 'bg-yellow-400' : 'bg-gray-400';
  const statusLabel = runnerStatus === 'online' ? 'Online' : runnerStatus === 'idle' ? 'Idle' : 'Offline';
  const machineName = state.runner.machine_name || 'Unknown';

  if (state.current) {
    const sim = state.current;
    const pct = (sim.progress_pct ?? 0).toFixed(0);

    return (
      <div className="flex flex-col items-start gap-1.5 w-full">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${statusColor} animate-pulse`} />
          <span className="text-xs font-medium text-gray-700 truncate max-w-[180px]">{sim.name}</span>
        </div>
        <span className="text-[10px] text-gray-400 font-mono">{machineName}</span>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${Math.min(Number(pct), 100)}%` }}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{pct}%</span>
          {state.queue.length > 0 && <span>+{state.queue.length} queued</span>}
          {state.completed.length > 0 && <span>{state.completed.length} done</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5 w-full">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
        <span className="text-xs font-medium text-gray-600">{statusLabel}</span>
      </div>
      <span className="text-[10px] text-gray-400 font-mono">{machineName}</span>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        {state.queue.length > 0 && <span>{state.queue.length} queued</span>}
        {state.completed.length > 0 && <span>{state.completed.length} completed</span>}
        {state.errors.length > 0 && <span className="text-red-500">{state.errors.length} errors</span>}
        {state.queue.length === 0 && state.completed.length === 0 && state.errors.length === 0 && (
          <span>No simulations</span>
        )}
      </div>
    </div>
  );
}

export default function ToolCard({
  tool,
  cfdStatus,
  highlighted,
  title,
  onOpen,
}: {
  tool: ToolPart;
  cfdStatus: CfdDashboardState | null;
  highlighted?: boolean;
  title?: string;
  onOpen: (part: ToolPart) => void;
}) {
  const heading = title ?? (tool.dashboardTitle || tool.name);
  const openUrl = resolveOpenUrl(tool);

  return (
    <div
      data-tool-id={tool.id}
      className={`relative flex-shrink-0 w-80 bg-white rounded-xl p-6 border transition-all flex flex-col ${
        highlighted ? 'border-blue-400 shadow-lg ring-2 ring-blue-200' : 'border-gray-200'
      } ${tool.wip ? 'opacity-75' : 'hover:border-gray-300 hover:shadow-lg'} ${
        openUrl && !tool.wip ? 'cursor-pointer' : ''
      }`}
      onClick={() => {
        if (openUrl && !tool.wip) onOpen(tool);
      }}
    >
      {tool.wip && (
        <span className="absolute top-3 right-3 px-2 py-1 bg-gray-200 text-gray-500 text-xs font-medium rounded-full">
          WIP
        </span>
      )}

      <div className="mb-4">
        {tool.liveStatus === 'cfd' ? (
          <CfdBadge state={cfdStatus} />
        ) : (
          <div className="text-3xl">{tool.icon}</div>
        )}
      </div>

      <h3 className="text-xl font-semibold mb-2 text-gray-900">{heading}</h3>

      {tool.description && <p className="text-gray-600 text-sm mb-4 flex-grow">{tool.description}</p>}

      {tool.kind !== 'web' && tool.openHint && (
        <p className="text-xs text-gray-500 mb-4">{tool.openHint}</p>
      )}

      {tool.hasLaunchButton && (
        <div className="flex gap-3 mt-auto">
          <button className="flex-1 px-4 py-2 bg-black hover:bg-gray-800 rounded-lg text-white font-medium transition-colors">
            LAUNCH GPT →
          </button>
        </div>
      )}

      {openUrl && (
        <div className="flex gap-3 mt-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(tool);
            }}
            className="flex-1 px-4 py-2 bg-black hover:bg-gray-800 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>{tool.partKey ? `Open ${tool.part}` : ctaLabel(tool)}</span>
            {!isInternalUrl(openUrl) && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
