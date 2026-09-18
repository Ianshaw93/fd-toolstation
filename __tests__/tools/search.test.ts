import { readFileSync } from 'fs';
import { join } from 'path';
import { filterTools, navigateToTool, searchTools, expandTokens } from '../../lib/tools/search';
import {
  CATALOGUE,
  UPLOAD_CANVAS_MODES,
  UPLOAD_CANVAS_ORIGIN,
  ctaLabel,
  partLabel,
  uploadCanvasModeUrl,
} from '../../lib/tools/catalogue';
import type { ToolPart } from '../../lib/tools/types';

const UPLOAD_CANVAS_GIT_DEV_HOST = 'upload-canvas-git-dev-fire-dynamics-projects.vercel.app';
const TOOL_UX_SOURCE_FILES = [
  join(__dirname, '../../lib/tools/catalogue.ts'),
  join(__dirname, '../../lib/tools/search.ts'),
  join(__dirname, '../../lib/tools/index.ts'),
];

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
    id: 'secret-lab',
    name: 'Secret Lab',
    part: 'Internal only',
    parentTool: 'Secret Lab',
    parentId: 'secret-lab',
    kind: 'web',
    description: 'Intentionally hidden fixture for the shelved-exclusion test',
    aliases: ['secret', 'hidden lab'],
    phrases: [],
    showOnDashboard: true,
    shelved: true,
    icon: '🔒',
    url: '/secret-lab',
  },
];

describe('uploadCanvasModeUrl — production main', () => {
  it('deep-links every Upload Canvas mode (including efs) to production, not git-dev', () => {
    expect(UPLOAD_CANVAS_MODES).toEqual(['fdsGen', 'radiation', 'timeEq', 'efs']);
    for (const mode of UPLOAD_CANVAS_MODES) {
      expect(uploadCanvasModeUrl(mode)).toBe(`${UPLOAD_CANVAS_ORIGIN}/?mode=${mode}`);
      expect(uploadCanvasModeUrl(mode)).not.toContain(UPLOAD_CANVAS_GIT_DEV_HOST);
    }
    expect(uploadCanvasModeUrl('efs')).toBe('https://upload-canvas.vercel.app/?mode=efs');
  });

  it('keeps the git-dev Vercel host out of catalogue/search UX sources', () => {
    for (const file of TOOL_UX_SOURCE_FILES) {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toContain('upload-canvas-git-dev');
      expect(src).not.toContain('UPLOAD_CANVAS_DEV');
      expect(src).not.toContain('fire-dynamics-projects');
      expect(src).not.toMatch(/dev app/i);
      expect(src).not.toMatch(/production does not have this mode/i);
    }
  });
});

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
    expect(filterTools('secret', sample)).toEqual([]);
    expect(filterTools('Secret Lab', sample)).toEqual([]);
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

  it('short query "cfd" includes post-processing and FDS gen, not the shelved dashboard', () => {
    const result = searchTools('cfd');
    const ids = result.matches.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['cfd-post-processing', 'upload-canvas-fdsGen']));
    expect(ids).not.toContain('cfd-dashboard');
  });

  it('short query "fds" includes the same CFD/FDS family the other way round', () => {
    const result = searchTools('fds');
    const ids = result.matches.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['upload-canvas-fdsGen', 'cfd-post-processing']));
    expect(ids).not.toContain('cfd-dashboard');
  });

  it('treats cfd and fds as bidirectional synonyms', () => {
    expect(expandTokens(['cfd']).has('fds')).toBe(true);
    expect(expandTokens(['fds']).has('cfd')).toBe(true);
  });

  it('queries macs / macs+ / i-macs hit the MACS+ catalogue entry', () => {
    for (const query of ['macs', 'macs+', 'i-macs']) {
      const result = searchTools(query);
      expect(result.matches.some((t) => t.id === 'i-macs')).toBe(true);
    }
  });

  it('post-processing phrases hit cfd-post-processing', () => {
    for (const query of ['cfd post', 'post processing', 'cfdreportgen']) {
      const result = searchTools(query);
      expect(result.matches.some((t) => t.id === 'cfd-post-processing')).toBe(true);
    }
  });

  it('GitHub desktop apps are first-class catalogue rows, not legacy or shelved', () => {
    for (const id of ['i-macs', 'cfd-post-processing']) {
      const tool = CATALOGUE.find((t) => t.id === id);
      expect(tool).toBeDefined();
      expect(tool?.kind).toBe('desktop');
      expect(tool?.legacy).toBeFalsy();
      expect(tool?.shelved).toBeFalsy();
      expect(tool?.url).toMatch(/^https:\/\/github\.com\/Fire-Dynamics-Group\//);
      expect(tool?.deepLink).toBe(tool?.url);
      expect(tool?.openHint).toMatch(/Desktop app/i);
    }
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

  it('web Warehouse Smoke Layer supersedes the python script for query "warehouse"', () => {
    const result = searchTools('warehouse');
    expect(result.matches[0].id).toBe('warehouse-smoke');
    expect(result.matches[0].kind).toBe('web');
    expect(result.suggestion?.part.id).toBe('warehouse-smoke');
    expect(result.matches.some((t) => t.id === 'warehouse-smoke-python')).toBe(false);
    expect(result.suggestion?.why.toLowerCase()).not.toMatch(/dropbox/);
  });

  it('python / source queries still surface the original warehouse script', () => {
    const result = searchTools('warehouse_smoke_layer.py');
    expect(result.matches.some((t) => t.id === 'warehouse-smoke-python')).toBe(true);
  });

  it('efs uses the upload-canvas production host, not git-dev', () => {
    const result = searchTools('external fire spread tool where I draw on warehouse plans');
    const link = result.suggestion?.part.deepLink ?? '';
    expect(link).toBe(`${UPLOAD_CANVAS_ORIGIN}/?mode=efs`);
    expect(link).toContain('mode=efs');
    expect(link).not.toContain('upload-canvas-git-dev');
    expect(result.suggestion?.label).toBe('Upload Canvas → External Fire Spread');
    expect(result.suggestion?.why).toMatch(/mode/i);
    expect(result.suggestion?.why).not.toMatch(/dev app/i);
    expect(result.suggestion?.why).not.toMatch(/production does not have this mode/i);
    expect(result.suggestion?.why).not.toMatch(/dropbox/i);
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
      expect(hit?.deepLink).toBe(uploadCanvasModeUrl(mode as 'fdsGen' | 'radiation' | 'timeEq' | 'efs'));
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

  it('CTA copy names the Upload Canvas part, not the shell', () => {
    const efs = CATALOGUE.find((t) => t.id === 'upload-canvas-efs') as ToolPart;
    expect(partLabel(efs)).toBe('Upload Canvas → External Fire Spread');
    expect(ctaLabel(efs)).toBe('Open in External Fire Spread mode');
  });

  it('short query "br" returns more than 3 matches including calculator and canvas efs', () => {
    const result = searchTools('br');
    expect(result.matches.length).toBeGreaterThan(3);
    expect(result.matches.some((t) => t.id === 'efs-calculator')).toBe(true);
    expect(result.matches.some((t) => t.id === 'upload-canvas-efs')).toBe(true);
    expect(result.matches.find((t) => t.id === 'upload-canvas-efs')?.deepLink).toBe(
      `${UPLOAD_CANVAS_ORIGIN}/?mode=efs`,
    );
  });

  it('short query "bre" includes upload-canvas-efs and the EFS calculator', () => {
    const result = searchTools('bre');
    expect(result.matches.length).toBeGreaterThan(3);
    expect(result.matches.some((t) => t.id === 'upload-canvas-efs')).toBe(true);
    expect(result.matches.some((t) => t.id === 'efs-calculator')).toBe(true);
  });

  it('query "7974" / "bs 7974" ranks Warehouse Smoke Layer web first, not python', () => {
    for (const query of ['7974', 'bs 7974', 'pd 7974']) {
      const result = searchTools(query);
      expect(result.matches[0].id).toBe('warehouse-smoke');
      expect(result.matches[0].kind).toBe('web');
      expect(result.matches.some((t) => t.id === 'warehouse-smoke-python')).toBe(false);
      expect(result.suggestion?.part.id).toBe('warehouse-smoke');
      expect(result.suggestion?.why.toLowerCase()).not.toMatch(/dropbox/);
    }
  });

  it('does not hard-cap matches at 3 in the matcher or layout source', () => {
    const files = [
      join(__dirname, '../../lib/tools/search.ts'),
      join(__dirname, '../../components/home/search-layouts/CommandPaletteLayout.tsx'),
      join(__dirname, '../../components/home/search-layouts/FilterGridLayout.tsx'),
    ];
    for (const file of files) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/\.slice\s*\(\s*0\s*,\s*3\s*\)/);
    }
  });

  it('query "br" exposes a BR 187 / BRE 135 based-on line for radiation and EFS rows', () => {
    const result = searchTools('br');
    expect(result.basedOn['upload-canvas-radiation']).toMatch(/BR 187/i);
    expect(result.basedOn['upload-canvas-efs']).toMatch(/BRE 135|BR 187/i);
    expect(result.basedOn['efs-calculator']).toMatch(/BRE 135|BR 187/i);
    expect(result.basedOn['warehouse-smoke']).toBeUndefined();
  });

  it('query "7974" shows a 7974 based-on line for warehouse, not the full source dump', () => {
    const result = searchTools('7974');
    expect(result.basedOn['warehouse-smoke']).toMatch(/7974/);
    expect(result.basedOn['warehouse-smoke']).not.toMatch(/CIBSE/i);
    expect(result.basedOn['warehouse-smoke']).not.toMatch(/Drysdale/i);
    expect(result.suggestion?.basedOn).toMatch(/7974/);
  });

  it('name-only hits omit the based-on line', () => {
    const result = searchTools('sprinkler');
    expect(result.basedOn['sprinkler-grid']).toBeUndefined();
  });
});

describe('navigateToTool', () => {
  const open = jest.fn();

  beforeEach(() => {
    open.mockReset();
    window.open = open as unknown as typeof window.open;
  });

  it('opens the efs mode deep link in a new tab', () => {
    const efs = CATALOGUE.find((t) => t.id === 'upload-canvas-efs') as ToolPart;
    const push = jest.fn();
    navigateToTool(efs, { push });
    expect(push).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(
      `${UPLOAD_CANVAS_ORIGIN}/?mode=efs`,
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('pushes internal routes in the same tab', () => {
    const calc = CATALOGUE.find((t) => t.id === 'efs-calculator') as ToolPart;
    const push = jest.fn();
    navigateToTool(calc, { push });
    expect(push).toHaveBeenCalledWith('/external-firespread');
    expect(open).not.toHaveBeenCalled();
  });
});
