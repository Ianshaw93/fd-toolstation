import { filterTools, searchTools } from '../../lib/tools/search';
import { CATALOGUE, UPLOAD_CANVAS_ORIGIN } from '../../lib/tools/catalogue';
import type { ToolPart } from '../../lib/tools/types';

const sample: ToolPart[] = [
  {
    id: 'sprinkler-grid',
    name: 'Sprinkler Grid Calculator',
    part: 'Grid layout',
    parentTool: 'Sprinkler Grid Calculator',
    parentId: 'sprinkler-grid',
    kind: 'web',
    description: 'Calculate and design sprinkler grid layouts for optimal coverage',
    aliases: ['sprinkler', 'sprinklers', 'grid'],
    phrases: [],
    showOnDashboard: true,
    icon: '💧',
    url: 'https://sprinklers-web-app.vercel.app/',
  },
  {
    id: 'warehouse-smoke',
    name: 'Warehouse Smoke Layer',
    part: 'ASET/RSET assessment',
    parentTool: 'Warehouse Smoke Layer',
    parentId: 'warehouse-smoke',
    kind: 'web',
    description: 'Smoke layer descent and ASET/RSET assessment for a base warehouse',
    aliases: ['warehouse smoke', 'aset', 'rset', 'smoke layer'],
    phrases: [],
    showOnDashboard: true,
    icon: '🏭',
    url: '/warehouse-smoke',
  },
  {
    id: 'cfd-dashboard',
    name: 'CFD Dashboard',
    part: 'Live FDS status',
    parentTool: 'CFD Dashboard',
    parentId: 'cfd-dashboard',
    kind: 'web',
    description: 'Live FDS simulation status',
    aliases: ['cfd', 'fds'],
    phrases: [],
    showOnDashboard: true,
    shelved: true,
    icon: '🖥️',
    url: '/cfd-dashboard',
  },
];

describe('filterTools', () => {
  it('returns all non-shelved dashboard tools for an empty query', () => {
    const matches = filterTools('', sample);
    expect(matches.map((t) => t.id)).toEqual(['sprinkler-grid', 'warehouse-smoke']);
  });

  it('returns all non-shelved dashboard tools for a whitespace-only query', () => {
    const matches = filterTools('   ', sample);
    expect(matches.map((t) => t.id)).toEqual(['sprinkler-grid', 'warehouse-smoke']);
  });

  it('matches a title hit', () => {
    const matches = filterTools('Sprinkler Grid', sample);
    expect(matches.map((t) => t.id)).toEqual(['sprinkler-grid']);
  });

  it('matches a description hit', () => {
    const matches = filterTools('optimal coverage', sample);
    expect(matches.map((t) => t.id)).toEqual(['sprinkler-grid']);
  });

  it('matches an alias / keyword hit', () => {
    const matches = filterTools('ASET', sample);
    expect(matches.map((t) => t.id)).toEqual(['warehouse-smoke']);
  });

  it('is case-insensitive and trims the query', () => {
    const matches = filterTools('  SpRiNkLeR  ', sample);
    expect(matches.map((t) => t.id)).toEqual(['sprinkler-grid']);
  });

  it('returns no matches when nothing hits', () => {
    expect(filterTools('bananas', sample)).toEqual([]);
  });

  it('excludes shelved tools even when they would otherwise match', () => {
    expect(filterTools('cfd', sample)).toEqual([]);
    expect(filterTools('CFD Dashboard', sample)).toEqual([]);
  });
});

describe('searchTools — real catalogue', () => {
  it('browse mode lists the current non-shelved dashboard cards', () => {
    const result = searchTools('');
    expect(result.mode).toBe('browse');
    expect(result.matches.every((t) => t.showOnDashboard && !t.shelved)).toBe(true);
    expect(result.matches.map((t) => t.dashboardTitle || t.name)).toEqual(
      expect.arrayContaining([
        'Search & Rescue Bot',
        'Site Visit App Report Generator',
        'Sprinkler Grid Calculator',
        'PDF Markup Tools',
        'Fee Proposal Generator',
        'External Fire Spread Calculator',
        'Warehouse Smoke Layer',
      ]),
    );
    expect(result.matches.some((t) => t.id === 'cfd-dashboard')).toBe(false);
  });

  it('short query "sprinkler" surfaces the sprinkler grid and hides the rest', () => {
    const result = searchTools('sprinkler');
    expect(result.matches.some((t) => t.id === 'sprinkler-grid')).toBe(true);
    expect(result.matches.some((t) => t.id === 'warehouse-smoke')).toBe(false);
  });

  it('short query "BRE" surfaces the EFS calculator', () => {
    const result = searchTools('BRE');
    expect(result.matches.some((t) => t.id === 'efs-calculator')).toBe(true);
  });

  it('short query "warehouse" surfaces warehouse smoke', () => {
    const result = searchTools('warehouse');
    expect(result.matches.some((t) => t.parentId === 'warehouse-smoke' || t.id === 'warehouse-smoke')).toBe(
      true,
    );
  });

  it('Ian NL phrase resolves to Upload Canvas → efs with mode in the deep link', () => {
    const result = searchTools('external fire spread tool where I draw on warehouse plans');
    expect(result.suggestion).not.toBeNull();
    expect(result.suggestion?.part.id).toBe('upload-canvas-efs');
    expect(result.suggestion?.label).toMatch(/Upload Canvas/i);
    expect(result.suggestion?.label).toMatch(/External Fire Spread/i);
    expect(result.suggestion?.part.deepLink).toBe(`${UPLOAD_CANVAS_ORIGIN}/?mode=efs`);
    expect(result.suggestion?.part.deepLink).toContain('mode=efs');
    expect(result.matches[0].id).toBe('upload-canvas-efs');
  });

  it('does not pick the EFS calculator or warehouse smoke as the top hit for the draw-on-plans phrase', () => {
    const result = searchTools('external fire spread tool where I draw on warehouse plans');
    expect(result.suggestion?.part.id).not.toBe('efs-calculator');
    expect(result.suggestion?.part.id).not.toBe('warehouse-smoke');
  });

  it('BRE 135 / calculator numbers resolve to the EFS calculator, not canvas efs', () => {
    for (const query of ['BRE 135', 'elevation assessment', 'calculator numbers for external fire spread']) {
      const result = searchTools(query);
      expect(result.matches[0].id).toBe('efs-calculator');
    }
  });

  it('warehouse smoke / ASET / RSET / smoke layer resolve to Warehouse Smoke', () => {
    for (const query of ['warehouse smoke', 'ASET', 'RSET', 'smoke layer']) {
      const result = searchTools(query);
      expect(result.matches.some((t) => t.id === 'warehouse-smoke')).toBe(true);
    }
  });

  it('site visit / pins / A3 resolve to Site Visit report gen', () => {
    for (const query of ['site visit report', 'pins', 'A3']) {
      const result = searchTools(query);
      expect(result.matches.some((t) => t.id === 'site-visit-report')).toBe(true);
    }
  });

  it('fee proposal resolves to the fee proposal generator', () => {
    const result = searchTools('fee proposal');
    expect(result.matches.some((t) => t.id === 'fee-proposal')).toBe(true);
  });

  it('email search / Mail Marshal / search & rescue resolve to that card', () => {
    for (const query of ['email search', 'Mail Marshal', 'search & rescue']) {
      const result = searchTools(query);
      expect(result.matches.some((t) => t.id === 'search-rescue')).toBe(true);
    }
  });

  it('canvas mode queries deep-link to the named Upload Canvas part', () => {
    const cases: Array<{ query: string; id: string; mode: string }> = [
      { query: 'fds generation', id: 'upload-canvas-fdsGen', mode: 'fdsGen' },
      { query: 'radiation canvas', id: 'upload-canvas-radiation', mode: 'radiation' },
      { query: 'time equivalence', id: 'upload-canvas-timeEq', mode: 'timeEq' },
      { query: 'upload canvas efs', id: 'upload-canvas-efs', mode: 'efs' },
    ];
    for (const { query, id, mode } of cases) {
      const result = searchTools(query);
      const hit = result.matches.find((t) => t.id === id) ?? result.suggestion?.part;
      expect(hit?.id).toBe(id);
      expect(hit?.deepLink).toBe(`${UPLOAD_CANVAS_ORIGIN}/?mode=${mode}`);
    }
  });

  it('NL queries expose a suggestion panel payload rather than only a thinned list', () => {
    const result = searchTools('external fire spread tool where I draw on warehouse plans');
    expect(result.mode).toBe('intent');
    expect(result.suggestion?.why.length).toBeGreaterThan(0);
    expect(result.confidence === 'high' || result.confidence === 'medium').toBe(true);
  });

  it('documented Excel EFS workbook is searchable by filename', () => {
    const result = searchTools('input_sheet_and_tables_v6');
    expect(result.matches.some((t) => t.id === 'efs-excel-v6')).toBe(true);
    expect(result.matches.find((t) => t.id === 'efs-excel-v6')?.kind).toBe('excel');
  });

  it('catalogue includes first-class kind fields for later exe/dropbox rows', () => {
    const kinds = new Set(CATALOGUE.map((t) => t.kind));
    expect(kinds.has('web')).toBe(true);
    expect(kinds.has('excel')).toBe(true);
    expect(kinds.has('desktop')).toBe(true);
  });
});
