import { CATALOGUE } from '../../lib/tools/catalogue';
import { searchTools } from '../../lib/tools/search';

/**
 * Compact coverage eval: each query must surface the expected tool id(s).
 * Catches silent shelving / omitted catalogue rows. Does not assert rank.
 *
 * `cfd` / `fds` are the same family: fire-engineering CFD here uses FDS, so
 * either query must hit dashboard, post-processing, and FDS generation.
 */
export const SEARCH_COVERAGE_EVAL: Array<{ query: string; expectedIds: string[] }> = [
  {
    query: 'cfd',
    expectedIds: ['cfd-dashboard', 'cfd-post-processing', 'upload-canvas-fdsGen'],
  },
  {
    query: 'fds',
    expectedIds: ['upload-canvas-fdsGen', 'cfd-dashboard', 'cfd-post-processing'],
  },
  { query: 'warehouse', expectedIds: ['warehouse-smoke'] },
  { query: 'BRE', expectedIds: ['efs-calculator'] },
  { query: 'br', expectedIds: ['efs-calculator'] },
  { query: 'macs', expectedIds: ['i-macs'] },
  { query: 'cfd post', expectedIds: ['cfd-post-processing'] },
];

describe('search coverage eval', () => {
  it.each(SEARCH_COVERAGE_EVAL)('query "$query" includes $expectedIds', ({ query, expectedIds }) => {
    const ids = searchTools(query).matches.map((tool) => tool.id);
    for (const expectedId of expectedIds) {
      expect(CATALOGUE.some((tool) => tool.id === expectedId)).toBe(true);
      expect(ids).toContain(expectedId);
    }
  });
});
