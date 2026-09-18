import type { CfdDashboardState } from '../../../lib/cfd-api';
import type { ToolSearchResult, ToolPart } from '../../../lib/tools/types';

/**
 * Props every search-results prototype must accept.
 * Swap the active layout in `./index.ts` without touching the matcher or homepage chrome.
 */
export type ToolSearchLayoutProps = {
  result: ToolSearchResult;
  onOpen: (part: ToolPart) => void;
  cfdStatus?: CfdDashboardState | null;
};
