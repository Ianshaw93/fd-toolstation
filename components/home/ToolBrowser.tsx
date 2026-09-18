'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchDashboardState, CfdDashboardState } from '../../lib/cfd-api';
import { dashboardCards } from '../../lib/tools/catalogue';
import { navigateToTool } from '../../lib/tools/search';
import ToolCard from './ToolCard';
import ToolSearch from './ToolSearch';

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

function DashboardCarousel({ cfdStatus }: { cfdStatus: CfdDashboardState | null }) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const cards = dashboardCards();

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
  }, [cards.length]);

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
    <div className="relative">
      {canScrollLeft && (
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
        className="flex gap-6 overflow-x-auto scrollbar-hide px-12 pb-4"
      >
        {cards.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            cfdStatus={cfdStatus}
            onOpen={(part) => navigateToTool(part, router)}
          />
        ))}
      </div>

      {canScrollRight && (
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
  );
}

export default function ToolBrowser() {
  const cfdStatus = useCfdStatus();

  return (
    <ToolSearch cfdStatus={cfdStatus}>
      <DashboardCarousel cfdStatus={cfdStatus} />
    </ToolSearch>
  );
}
