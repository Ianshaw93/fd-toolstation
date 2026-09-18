'use client';

import { useRef, type KeyboardEvent } from 'react';

export default function ToolSearchInput({
  query,
  onQueryChange,
  onKeyDown,
  focusAccent = 'gray',
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  focusAccent?: 'gray' | 'blue';
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const ringClass = focusAccent === 'blue' ? 'focus:ring-blue-400' : 'focus:ring-gray-400';

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.key === 'Escape') {
      onQueryChange('');
      event.currentTarget.focus();
    }
  };

  return (
    <div className="mb-8 flex justify-center">
      <div className="relative w-full max-w-xl">
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search tools..."
          aria-label="Search tools"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={query.trim().length > 0}
          aria-controls="tool-search-palette"
          className={`w-full px-4 py-3 pl-10 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 ${ringClass} focus:border-transparent`}
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
  );
}
