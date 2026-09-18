'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { CfdDashboardState } from '../../lib/cfd-api';
import { TOOL_SEARCH_DEBOUNCE_MS, ensureSearchLogged, logToolSearchClick } from '../../lib/tools/analytics';
import { ALL_TOOLS } from '../../lib/tools/catalogue';
import { navigateToTool, searchTools } from '../../lib/tools/search';
import type { ToolPart } from '../../lib/tools/types';
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
  const started = typeof performance !== 'undefined' ? performance.now() : 0;
  const result = searchTools(query, ALL_TOOLS);
  const latencyMs = typeof performance !== 'undefined' ? Math.round(performance.now() - started) : null;
  const latencyRef = useRef(latencyMs);
  const resultRef = useRef(result);
  latencyRef.current = latencyMs;
  resultRef.current = result;

  const browsing = result.mode === 'browse';

  useEffect(() => {
    if (browsing) {
      ensureSearchLogged(resultRef.current);
      return;
    }
    const handle = window.setTimeout(() => {
      ensureSearchLogged(resultRef.current, { latencyMs: latencyRef.current });
    }, TOOL_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [browsing, query]);

  const onOpen = (part: ToolPart) => {
    logToolSearchClick(part, result, { latencyMs: latencyRef.current });
    navigateToTool(part, router);
  };

  return (
    <>
      <ToolSearchInput
        query={query}
        onQueryChange={setQuery}
        focusAccent={browsing ? 'gray' : 'blue'}
      />
      {browsing ? (
        children
      ) : (
        <ActiveSearchLayout result={result} cfdStatus={cfdStatus} onOpen={onOpen} />
      )}
    </>
  );
}
