'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchDashboardState, CfdDashboardState } from '../../lib/cfd-api';
import { ALL_TOOLS, partLabel } from '../../lib/tools/catalogue';
import { isInternalUrl, resolveOpenUrl, searchTools } from '../../lib/tools/search';
import type { ToolPart } from '../../lib/tools/types';

function useCfdStatus() {
  const [state, setState] = useState<CfdDashboardState | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const data = await fetchDashboardState();
        if (active) setState(data);
      } catch {
        if (active) setState(null);
      }
    }

    poll();
    const interval = setInterval(poll, 15_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return state;
}

function CfdBadge({ state }: { state: CfdDashboardState | null }) {
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

function openTool(url: string, router: { push: (href: string) => void }) {
  if (isInternalUrl(url)) {
    router.push(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function ToolCard({
  tool,
  cfdStatus,
  highlighted,
}: {
  tool: ToolPart;
  cfdStatus: CfdDashboardState | null;
  highlighted?: boolean;
}) {
  const router = useRouter();
  const title = partLabel(tool);
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
        if (openUrl && !tool.wip) openTool(openUrl, router);
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

      <h3 className="text-xl font-semibold mb-2 text-gray-900">{title}</h3>

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
              openTool(openUrl, router);
            }}
            className="flex-1 px-4 py-2 bg-black hover:bg-gray-800 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>
              {tool.partKey
                ? `Open ${tool.part}`
                : isInternalUrl(openUrl)
                  ? 'Open'
                  : 'Open App'}
            </span>
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

export default function ToolBrowser() {
  const router = useRouter();
  const cfdStatus = useCfdStatus();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const result = searchTools(query, ALL_TOOLS);
  const browsing = result.mode === 'browse';
  const suggestionUrl = result.suggestion ? resolveOpenUrl(result.suggestion.part) : undefined;

  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollability();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollability);
      window.addEventListener('resize', checkScrollability);
      return () => {
        container.removeEventListener('scroll', checkScrollability);
        window.removeEventListener('resize', checkScrollability);
      };
    }
  }, [result.matches.length, browsing]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      const newScrollLeft =
        scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth',
      });
    }
  };

  return (
    <>
      <div className="mb-8 flex justify-center">
        <div className="relative w-full max-w-md">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('');
                e.currentTarget.focus();
              }
            }}
            placeholder="Search tools..."
            aria-label="Search tools"
            className="w-full px-4 py-3 pl-10 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {result.suggestion && (
        <div
          className="mb-8 max-w-2xl mx-auto rounded-xl border border-blue-200 bg-blue-50 p-5"
          data-testid="tool-suggestion"
        >
          <p className="text-sm text-blue-800 mb-1">You&apos;re likely looking for:</p>
          <h2 className="text-xl font-semibold text-gray-900">{result.suggestion.label}</h2>
          <p className="text-sm text-gray-600 mt-2">{result.suggestion.why}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {suggestionUrl && (
              <button
                type="button"
                onClick={() => openTool(suggestionUrl, router)}
                className="px-4 py-2 bg-black hover:bg-gray-800 rounded-lg text-white font-medium transition-colors"
              >
                {result.suggestion.part.partKey
                  ? `Open in ${result.suggestion.part.part} mode`
                  : isInternalUrl(suggestionUrl)
                    ? 'Open'
                    : 'Open App'}
              </button>
            )}
            {result.suggestion.part.openHint && !suggestionUrl && (
              <p className="text-sm text-gray-700">{result.suggestion.part.openHint}</p>
            )}
          </div>
        </div>
      )}

      {result.matches.length === 0 ? (
        <p className="text-center text-gray-500 py-12" data-testid="tool-search-empty">
          No tools match that search. Try a tool name, alias, or what you want to do.
        </p>
      ) : (
        <div className="relative">
          {browsing && canScrollLeft && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
              <button
                onClick={() => scroll('left')}
                className="bg-gray-800 hover:bg-gray-700 rounded-full p-3 transition-all shadow-lg"
                aria-label="Scroll left"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          )}

          <div
            ref={scrollContainerRef}
            onScroll={checkScrollability}
            className={
              browsing
                ? 'flex gap-6 overflow-x-auto scrollbar-hide px-12 pb-4'
                : 'flex flex-wrap justify-center gap-6 px-4 pb-4'
            }
          >
            {result.matches.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                cfdStatus={cfdStatus}
                highlighted={result.suggestion?.part.id === tool.id}
              />
            ))}
          </div>

          {browsing && canScrollRight && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
              <button
                onClick={() => scroll('right')}
                className="bg-gray-800 hover:bg-gray-700 rounded-full p-3 transition-all shadow-lg"
                aria-label="Scroll right"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
