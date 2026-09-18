import { CATALOGUE } from '../../lib/tools/catalogue';
import { searchTools } from '../../lib/tools/search';

/**
 * Compact coverage eval: each query must surface the expected tool id.
 * Catches silent shelving / omitted catalogue rows. Does not assert rank.
 */
export const SEARCH_COVERAGE_EVAL: Array<{ query: string; expectedId: string }> = [
  { query: 'cfd', expectedId: 'cfd-dashboard' },
  { query: 'warehouse', expectedId: 'warehouse-smoke' },
  { query: 'BRE', expectedId: 'efs-calculator' },
  { query: 'br', expectedId: 'efs-calculator' },
  { query: 'macs', expectedId: 'i-macs' },
  { query: 'cfd post', expectedId: 'cfd-post-processing' },
];

describe('search coverage eval', () => {
  it.each(SEARCH_COVERAGE_EVAL)(
    'query "$query" includes $expectedId',
    ({ query, expectedId }) => {
      const ids = searchTools(query).matches.map((tool) => tool.id);
      expect(CATALOGUE.some((tool) => tool.id === expectedId)).toBe(true);
      expect(ids).toContain(expectedId);
    },
  );
});
