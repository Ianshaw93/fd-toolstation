'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { CfdDashboardState } from '../../lib/cfd-api';
import { ALL_TOOLS } from '../../lib/tools/catalogue';
import { navigateToTool, searchTools } from '../../lib/tools/search';
import { ActiveSearchLayout } from './search-layouts';
import ToolSearchInput from './ToolSearchInput';

/**
 * Wires the matcher to a swappable results layout.
 * Browse (empty query) renders `children` — the existing homepage carousel —
 * so search UX can change without redesigning the dashboard.
 */
export default function ToolSearch({
  children,
  cfdStatus,
}: {
  children: ReactNode;
  cfdStatus: CfdDashboardState | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const result = searchTools(query, ALL_TOOLS);

  if (result.mode === 'browse') {
    return (
      <>
        <ToolSearchInput query={query} onQueryChange={setQuery} />
        {children}
      </>
    );
  }

  return (
    <>
      <ToolSearchInput query={query} onQueryChange={setQuery} />
      <ActiveSearchLayout
        result={result}
        cfdStatus={cfdStatus}
        onOpen={(part) => navigateToTool(part, router)}
      />
    </>
  );
}
