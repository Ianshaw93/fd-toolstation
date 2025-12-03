'use client';

import { useState, useRef, useEffect } from 'react';

interface AssistantCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  hasLaunchButton?: boolean;
  hasInstructions?: boolean;
}

const assistants: AssistantCard[] = [
  {
    id: '1',
    icon: '💬',
    title: 'Client Communication Agent',
    description: 'Enhance client relationships with strategic communication templates, follow-up',
  },
  {
    id: '2',
    icon: '🏠',
    title: 'Business & Life Guidance',
    description: 'Chat with an AI coach that unites data-driven business strategy and personal life guidance',
  },
  {
    id: '3',
    icon: '🔑',
    title: "Cam's AI V2",
    description: '',
    hasLaunchButton: true,
    hasInstructions: true,
  },
  {
    id: '4',
    icon: '🔧',
    title: 'Diagnosing & Fixing Agent',
    description: "Get your acquisition bottlenecks diagnosed by Cameron England's proven framework.",
  },
  {
    id: '5',
    icon: '▶️',
    title: 'VSL / Confirmation Page Vid Script AI',
    description: 'Use this License and Scale agent to help',
  },
];

export default function Home() {
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
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 text-white">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              LICENSE & SCALE
          </h1>
            <svg
              className="w-8 h-8 text-white"
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
          <p className="text-purple-200 text-sm mb-8">
            Navigate through our specialized AI assistant to accelerate your business growth.
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-800/50 hover:bg-purple-700/50 transition-colors">
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
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-800/50 hover:bg-purple-700/50 transition-colors">
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
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-800/50 hover:bg-purple-700/50 transition-colors">
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
              placeholder="Search AI assistants..."
              className="w-full px-4 py-3 pl-10 rounded-lg bg-purple-800/50 border border-purple-700/50 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-300"
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
                className="bg-purple-800/90 hover:bg-purple-700/90 rounded-full p-3 transition-all shadow-lg border-2 border-pink-500/50"
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
              <div className="w-0.5 h-16 bg-pink-500 mt-2"></div>
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
                className="flex-shrink-0 w-80 bg-purple-800/60 rounded-xl p-6 border border-purple-700/50 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/20"
              >
                {/* Icon */}
                <div className="mb-4">
                  {assistant.id === '3' ? (
                    <div className="w-16 h-16 rounded-full bg-purple-900/80 border-2 border-purple-500 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/50">
                      🔑
                    </div>
                  ) : (
                    <div className="text-3xl">{assistant.icon}</div>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold mb-2 text-white">
                  {assistant.title}
                </h3>

                {/* Description */}
                {assistant.description && (
                  <p className="text-purple-200 text-sm mb-4">
                    {assistant.description}
                  </p>
                )}

                {/* Action Buttons */}
                {assistant.hasLaunchButton && (
                  <div className="flex gap-3 mt-4">
                    <button className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition-colors">
                      LAUNCH GPT →
                    </button>
                    {assistant.hasInstructions && (
                      <button className="flex items-center gap-2 px-4 py-2 bg-purple-700/50 hover:bg-purple-600/50 rounded-lg text-white transition-colors">
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
              </div>
            ))}
          </div>

          {/* Right Arrow */}
          {canScrollRight && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
              <button
                onClick={() => scroll('right')}
                className="bg-purple-800/90 hover:bg-purple-700/90 rounded-full p-3 transition-all shadow-lg border-2 border-pink-500/50"
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
              <div className="w-0.5 h-16 bg-pink-500 mt-2"></div>
            </div>
          )}
        </div>

        {/* Plus Button (bottom right) */}
        <button className="fixed bottom-8 right-8 w-12 h-12 bg-purple-600 hover:bg-purple-500 rounded-full flex items-center justify-center text-2xl text-white shadow-lg transition-all hover:scale-110">
          +
        </button>
      </div>
    </div>
  );
}
