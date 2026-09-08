'use client';

import { useState, ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  // Tighter padding and a smaller heading for narrow hosts such as the Word task pane.
  dense?: boolean;
  children: ReactNode;
}

export default function CollapsibleSection({ title, defaultOpen = true, dense = false, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between ${dense ? 'px-3 py-2.5' : 'px-6 py-4'} bg-gray-50 hover:bg-gray-100 transition-colors`}
      >
        <h2 className={`${dense ? 'text-sm' : 'text-lg'} font-semibold text-gray-900`}>{title}</h2>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className={dense ? 'px-3 py-3' : 'px-6 py-4'}>{children}</div>}
    </div>
  );
}
