'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchDashboardState, CfdDashboardState } from '../lib/cfd-api';

interface AssistantCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  hasLaunchButton?: boolean;
  hasInstructions?: boolean;
  url?: string;
  wip?: boolean;
  liveStatus?: 'cfd';
}

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
    return () => { active = false; clearInterval(interval); };
  }, []);

  return state;
}

function CfdBadge({ state }: { state: CfdDashboardState | null }) {
  if (!state || !state.current) {
    // Nothing running or can't reach server — normal icon, no error
    return <span className="text-3xl">🖥️</span>;
  }

  const sim = state.current;
  const pct = (sim.progress_pct ?? 0).toFixed(0);
  const runnerOnline = state.runner.status === 'online';

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${runnerOnline ? 'bg-green-500 animate-pulse' : 'bg-yellow-400'}`} />
        <span className="text-xs font-medium text-gray-700 truncate max-w-[180px]">
          {sim.name}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
          style={{ width: `${Math.min(Number(pct), 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{pct}% complete</span>
      {state.queue.length > 0 && (
        <span className="text-xs text-gray-400">+{state.queue.length} queued</span>
      )}
    </div>
  );
}

const assistants: AssistantCard[] = [
  {
    id: '6',
    icon: '🖥️',
    title: 'CFD Dashboard',
    description: 'Live FDS simulation status — see what\'s running, progress, and queue',
    url: '/cfd-dashboard',
    liveStatus: 'cfd',
  },
  {
    id: '1',
    icon: '📊',
    title: 'Site Visit App Report Generator',
    description: 'Generate comprehensive site visit reports from uploaded data',
    url: 'https://site-right-report-gen.vercel.app/',
  },
  {
    id: '2',
    icon: '💧',
    title: 'Sprinkler Grid Calculator',
    description: 'Calculate and design sprinkler grid layouts for optimal coverage',
    url: 'https://sprinklers-web-app.vercel.app/',
  },
  {
    id: '3',
    icon: '📝',
    title: 'PDF Markup Tools',
    description: 'Upload and markup PDFs with canvas-based annotation tools',
    url: 'https://upload-canvas.vercel.app/',
  },
  {
    id: '4',
    icon: '💰',
    title: 'Fee Proposal Generator',
    description: 'Generate professional fire engineering fee proposal Word documents',
    url: '/fee-proposal',
  },
  {
    id: '5',
    icon: '🔥',
    title: 'External Fire Spread Calculator',
    description: 'BRE 135 external fire spread assessment for building elevations',
    url: '/external-firespread',
  },
];

export default function Home() {
  const router = useRouter();
  const cfdStatus = useCfdStatus();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      const newScrollLeft =
        scrollContainerRef.current.scrollLeft +
        (direction === 'left' ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <div className="container mx-auto px-6 py-8 flex-1">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
              Fire Dynamics
          </h1>
            <svg
              className="w-8 h-8 text-gray-900"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-900">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>Profile</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-900">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>Switch to Tools View</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-900">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Logout</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-8 flex justify-center">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Search tools..."
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

        {/* AI Assistant Cards with Navigation */}
        <div className="relative">
          {/* Left Arrow */}
          {canScrollLeft && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
              <button
                onClick={() => scroll('left')}
                className="bg-gray-800 hover:bg-gray-700 rounded-full p-3 transition-all shadow-lg"
                aria-label="Scroll left"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Cards Container */}
          <div
            ref={scrollContainerRef}
            onScroll={checkScrollability}
            className="flex gap-6 overflow-x-auto scrollbar-hide px-12 pb-4"
          >
            {assistants.map((assistant, index) => (
              <div
                key={assistant.id}
                className={`relative flex-shrink-0 w-80 bg-white rounded-xl p-6 border border-gray-200 transition-all flex flex-col ${
                  assistant.wip ? 'opacity-75' : 'hover:border-gray-300 hover:shadow-lg'
                } ${
                  assistant.url && !assistant.wip ? 'cursor-pointer' : ''
                }`}
                onClick={() => {
                  if (assistant.url && !assistant.wip) {
                    if (assistant.url.startsWith('/')) {
                      router.push(assistant.url);
                    } else {
                      window.open(assistant.url, '_blank', 'noopener,noreferrer');
                    }
                  }
                }}
              >
                {assistant.wip && (
                  <span className="absolute top-3 right-3 px-2 py-1 bg-gray-200 text-gray-500 text-xs font-medium rounded-full">
                    WIP
                  </span>
                )}

                {/* Icon / Live Status */}
                <div className="mb-4">
                  {assistant.liveStatus === 'cfd' ? (
                    <CfdBadge state={cfdStatus} />
                  ) : (
                    <div className="text-3xl">{assistant.icon}</div>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold mb-2 text-gray-900">
                  {assistant.title}
                </h3>

                {/* Description */}
                {assistant.description && (
                  <p className="text-gray-600 text-sm mb-4 flex-grow">
                    {assistant.description}
                  </p>
                )}

                {/* Action Buttons */}
                {assistant.hasLaunchButton && (
                  <div className="flex gap-3 mt-auto">
                    <button className="flex-1 px-4 py-2 bg-black hover:bg-gray-800 rounded-lg text-white font-medium transition-colors">
                      LAUNCH GPT →
                    </button>
                    {assistant.hasInstructions && (
                      <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-900 transition-colors">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>Instructions</span>
                      </button>
                    )}
                  </div>
                )}
                {assistant.url && (
                  <div className="flex gap-3 mt-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (assistant.url?.startsWith('/')) {
                          router.push(assistant.url);
                        } else {
                          window.open(assistant.url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-black hover:bg-gray-800 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span>{assistant.url?.startsWith('/') ? 'Open' : 'Open App'}</span>
                      {!assistant.url?.startsWith('/') && (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
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
            ))}
          </div>

          {/* Right Arrow */}
          {canScrollRight && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
              <button
                onClick={() => scroll('right')}
                className="bg-gray-800 hover:bg-gray-700 rounded-full p-3 transition-all shadow-lg"
                aria-label="Scroll right"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

      </div>
      
      {/* Footer */}
      <footer className="bg-blue-300 text-white py-6 px-6">
        <div className="container mx-auto">
          <h2 className="text-2xl font-semibold mb-1">Fire Dynamics</h2>
          <p className="text-sm">© 2022 Fire Dynamics Group Limited | Company number: 13476929</p>
        </div>
      </footer>
    </div>
  );
}
