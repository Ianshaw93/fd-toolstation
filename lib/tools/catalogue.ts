import type { ToolKind, ToolPart, UploadCanvasMode } from './types';

export const UPLOAD_CANVAS_ORIGIN = 'https://upload-canvas.vercel.app';

export const UPLOAD_CANVAS_MODES: UploadCanvasMode[] = [
  'fdsGen',
  'radiation',
  'timeEq',
  'efs',
];

export function uploadCanvasModeUrl(mode: UploadCanvasMode): string {
  return `${UPLOAD_CANVAS_ORIGIN}/?mode=${mode}`;
}

const canvasModes: Array<{
  partKey: UploadCanvasMode;
  part: string;
  description: string;
  aliases: string[];
  phrases: string[];
  calcSourceIds: string[];
}> = [
  {
    partKey: 'fdsGen',
    part: 'FDS Generation',
    description: 'Draw geometry on a plan and generate FDS input (meshes, obstructions, vents).',
    aliases: [
      'fds',
      'fds gen',
      'fdsgen',
      'fds generation',
      'pyrosim',
      'mesh',
      'obstruction',
      'nist fds',
      'fds user guide',
      'mesh alignment',
      'fds-smv',
    ],
    phrases: ['generate fds', 'fds from a plan', 'draw meshes on a plan'],
    calcSourceIds: ['nist-fds'],
  },
  {
    partKey: 'radiation',
    part: 'Radiation',
    description: 'BR 187 boundary distance / view-factor radiation calculator on a plan.',
    aliases: [
      'radiation',
      'heat flux',
      'view factor',
      'view factor radiation',
      'boundary distance',
      'br 187',
      'br187',
      'br-187',
    ],
    phrases: ['radiation on a plan', 'heat flux drawing', 'br 187 view factor'],
    calcSourceIds: ['br-187'],
  },
  {
    partKey: 'timeEq',
    part: 'Time Equivalence',
    description:
      'Draw on a plan for time-equivalence / reliability inputs (EC1 Annex A, PD 6688, ISO parametric fire).',
    aliases: [
      'time eq',
      'time equivalence',
      'timeeq',
      'time-equivalence',
      'en 1991',
      'en1991',
      'eurocode',
      'eurocode 1',
      'ec1',
      'ec1 annex a',
      'pd 6688',
      '6688',
      'quintiere',
      'iso 834',
      'iso fire',
      'parametric fire',
      'time equivalence reliability',
    ],
    phrases: ['time equivalence canvas', 'time eq on a plan', 'eurocode time equivalence'],
    calcSourceIds: ['ec1-annex-a', 'pd-6688', 'iso-834', 'quintiere'],
  },
  {
    partKey: 'efs',
    part: 'External Fire Spread',
    description: 'Draw on warehouse or elevation plans in External Fire Spread mode.',
    aliases: [
      'efs',
      'external fire spread',
      'warehouse plans',
      'draw on plans',
      'markup efs',
      'elevation plans',
      'bre',
      'bre 135',
      'bre135',
      'bre-135',
      'br 187',
      'br187',
      'br-187',
    ],
    phrases: [
      'external fire spread tool where I draw on warehouse plans',
      'draw on warehouse plans',
      'draw on plans for external fire spread',
      'upload canvas efs',
    ],
    calcSourceIds: ['bre-135', 'br-187'],
  },
];

const uploadCanvasParts: ToolPart[] = canvasModes.map((mode) => ({
  id: `upload-canvas-${mode.partKey}`,
  name: 'Upload Canvas',
  part: mode.part,
  partKey: mode.partKey,
  parentTool: 'Upload Canvas',
  parentId: 'upload-canvas',
  kind: 'web',
  description: mode.description,
  aliases: mode.aliases,
  phrases: mode.phrases,
  calcSourceIds: mode.calcSourceIds,
  deepLink: uploadCanvasModeUrl(mode.partKey),
  url: uploadCanvasModeUrl(mode.partKey),
  openHint: `Opens Upload Canvas in ${mode.part} mode (?mode=${mode.partKey}).`,
  icon: '📝',
}));

/**
 * Known Fire Dynamics tools / parts. Dashboard cards are the `showOnDashboard`
 * rows (current home carousel). Mode/part rows are searched even when they are
 * not shown as their own card.
 *
 * `kind: 'exe' | 'dropbox' | 'desktop'` plus `path` / `openHint` are first-class
 * so Dropbox EXEs can be appended later without a schema change.
 */
export const CATALOGUE: ToolPart[] = [
  {
    id: 'search-rescue',
    name: 'Search & Rescue Bot',
    part: 'Email / document search',
    parentTool: 'Search & Rescue Bot',
    parentId: 'search-rescue',
    kind: 'web',
    description: 'Search fire emails, reports, and docs across projects',
    aliases: [
      'mail marshal',
      'email search',
      'emails',
      'search and rescue',
      'search & rescue',
      'fire emails',
      'documents',
    ],
    phrases: ['search fire emails', 'mail marshal search'],
    url: 'https://s56p2ggh-3000.uks1.devtunnels.ms/',
    deepLink: 'https://s56p2ggh-3000.uks1.devtunnels.ms/',
    icon: '🚒',
    showOnDashboard: true,
  },
  {
    id: 'cfd-dashboard',
    name: 'CFD Dashboard',
    part: 'Live FDS status',
    parentTool: 'CFD Dashboard',
    parentId: 'cfd-dashboard',
    kind: 'web',
    description: "Live FDS simulation status — see what's running, progress, and queue",
    aliases: ['cfd', 'fds dashboard', 'simulation queue'],
    phrases: ['fds simulation status'],
    url: '/cfd-dashboard',
    deepLink: '/cfd-dashboard',
    icon: '🖥️',
    liveStatus: 'cfd',
    showOnDashboard: true,
  },
  {
    id: 'cfd-post-processing',
    name: 'CFD Post-Processing',
    part: 'FDS report pipeline',
    parentTool: 'CFD Post-Processing',
    parentId: 'cfd-post-processing',
    kind: 'desktop',
    description:
      'Tauri + React + FastAPI desktop app for FDS post-processing. Successor to CFDReportGen — common-corridor reports, charts gen, and FDS figures.',
    aliases: [
      'cfd post processing',
      'cfd-post-processing',
      'cfd post',
      'post processing',
      'cfd report',
      'charts gen',
      'cfd charts gen',
      'chart gen',
      'fds figures',
      'figure gen',
      'common corridor report',
      'common corridor report gen',
      'CFDReportGen',
      'cfdreportgen',
      'cfd report gen',
      'slice files',
      'open-plan report',
    ],
    phrases: ['cfd post processing', 'cfd report', 'common corridor report'],
    url: 'https://github.com/Fire-Dynamics-Group/cfd-post-processing',
    deepLink: 'https://github.com/Fire-Dynamics-Group/cfd-post-processing',
    openHint: 'Desktop app — see repo README / GitHub Releases',
    icon: '📈',
  },
  {
    id: 'site-visit-report',
    name: 'Site Visit App Report Generator',
    part: 'Site Right report',
    parentTool: 'Site Visit App Report Generator',
    parentId: 'site-visit-report',
    kind: 'web',
    description: 'Generate comprehensive site visit reports from uploaded data',
    aliases: ['site right', 'site visit', 'report gen', 'pins', 'a3', 'site visit report'],
    phrases: ['site visit report', 'pins on a plan', 'a3 site visit'],
    url: 'https://site-right-report-gen.vercel.app/',
    deepLink: 'https://site-right-report-gen.vercel.app/',
    icon: '📊',
    showOnDashboard: true,
  },
  {
    id: 'sprinkler-grid',
    name: 'Sprinkler Grid Calculator',
    part: 'Grid layout',
    parentTool: 'Sprinkler Grid Calculator',
    parentId: 'sprinkler-grid',
    kind: 'web',
    description: 'Calculate and design sprinkler grid layouts for optimal coverage',
    aliases: ['sprinkler', 'sprinklers', 'grid', 'sprinkler grid'],
    phrases: ['sprinkler grid', 'sprinkler coverage'],
    url: 'https://sprinklers-web-app.vercel.app/',
    deepLink: 'https://sprinklers-web-app.vercel.app/',
    icon: '💧',
    showOnDashboard: true,
  },
  {
    id: 'upload-canvas',
    name: 'PDF Markup Tools',
    part: 'Upload Canvas',
    parentTool: 'Upload Canvas',
    parentId: 'upload-canvas',
    kind: 'web',
    description: 'Upload and markup PDFs with canvas-based annotation tools',
    aliases: ['pdf', 'markup', 'canvas', 'upload canvas', 'annotation', 'pdf markup'],
    phrases: ['markup a pdf', 'upload a plan'],
    url: UPLOAD_CANVAS_ORIGIN + '/',
    deepLink: UPLOAD_CANVAS_ORIGIN + '/',
    icon: '📝',
    showOnDashboard: true,
    dashboardTitle: 'PDF Markup Tools',
  },
  ...uploadCanvasParts,
  {
    id: 'fee-proposal',
    name: 'Fee Proposal Generator',
    part: 'Web form',
    parentTool: 'Fee Proposal Generator',
    parentId: 'fee-proposal',
    kind: 'web',
    description: 'Generate professional fire engineering fee proposal Word documents',
    aliases: ['fee proposal', 'fees', 'quote', 'commercial'],
    phrases: ['fee proposal', 'write a fee letter'],
    url: '/fee-proposal',
    deepLink: '/fee-proposal',
    icon: '💰',
    showOnDashboard: true,
  },
  {
    id: 'fee-proposal-word-addin',
    name: 'Fee Proposal Word add-in',
    part: 'Word task pane',
    partKey: 'word-pane',
    parentTool: 'Fee Proposal Generator',
    parentId: 'fee-proposal',
    kind: 'addin',
    description: 'Build the fee proposal letter from a Word task pane on the Home tab.',
    aliases: ['word add-in', 'word addin', 'office add-in', 'task pane'],
    phrases: ['fee proposal in word', 'word add-in fee'],
    url: '/addin/word',
    deepLink: '/addin/word',
    openHint: 'In desktop Word: Home tab → Fee Proposal. Or open /addin/word.',
    icon: '💰',
  },
  {
    id: 'efs-calculator',
    name: 'External Fire Spread Calculator',
    part: 'BRE 135 assessment',
    parentTool: 'External Fire Spread Calculator',
    parentId: 'efs-calculator',
    kind: 'web',
    description: 'BRE 135 external fire spread assessment for building elevations',
    aliases: [
      'bre 135',
      'bre135',
      'bre-135',
      'br 187',
      'br187',
      'br-187',
      'bre',
      'efs',
      'external fire spread',
      'elevation assessment',
      'calculator',
      'unprotected areas',
      'calculator numbers',
    ],
    phrases: [
      'bre 135',
      'elevation assessment',
      'calculator numbers for external fire spread',
      'efs calculator',
    ],
    url: '/external-firespread',
    deepLink: '/external-firespread',
    icon: '🔥',
    showOnDashboard: true,
    calcSourceIds: ['bre-135', 'br-187'],
  },
  {
    id: 'warehouse-smoke',
    name: 'Warehouse Smoke Layer',
    part: 'ASET/RSET assessment',
    parentTool: 'Warehouse Smoke Layer',
    parentId: 'warehouse-smoke',
    kind: 'web',
    description: 'Smoke layer descent and ASET/RSET assessment for a base warehouse',
    aliases: [
      'warehouse smoke',
      'aset',
      'rset',
      'smoke layer',
      'tenability',
      'shed smoke',
      'bs 7974',
      'pd 7974',
      '7974',
      '7974-1',
      '7974-6',
      'pd 7974-1',
      'bs 7974-6',
      'pd 7974-6',
      'cibse',
      'cibse guide e',
      'drysdale',
    ],
    phrases: ['warehouse smoke', 'aset rset', 'smoke layer descent', 'bs 7974', 'cibse guide e'],
    url: '/warehouse-smoke',
    deepLink: '/warehouse-smoke',
    icon: '🏭',
    showOnDashboard: true,
    calcSourceIds: ['bs-pd-7974', 'cibse-guide-e', 'drysdale'],
  },
  {
    id: 'i-macs',
    name: 'MACS+ / i-macs',
    part: 'Structural automation',
    parentTool: 'MACS+ / i-macs',
    parentId: 'i-macs',
    kind: 'desktop',
    description:
      'Tauri desktop app for MACS+ / FRACOF tensile-membrane structural automation (composite floor). Primary product; successor to GUI click-automation in Fire-Dynamics-Group/macs.',
    aliases: [
      'macs',
      'macs+',
      'macs plus',
      'i-macs',
      'imacs',
      'i macs',
      'macs+ automation',
      'tensile membrane',
      'tensile-membrane',
      'tensile membrane action',
      'fracof',
      'composite floor',
      'structural automation',
    ],
    phrases: ['macs plus', 'tensile membrane', 'structural automation'],
    url: 'https://github.com/Fire-Dynamics-Group/i-macs',
    deepLink: 'https://github.com/Fire-Dynamics-Group/i-macs',
    openHint: 'Desktop app — see repo README / GitHub Releases',
    icon: '🏗️',
  },
  {
    id: 'efs-excel-v6',
    name: 'Shed Fire Strategy Excel',
    part: 'input_sheet_and_tables_v6.xlsm',
    partKey: 'input-sheet',
    parentTool: 'Shed Fire Strategy Excel',
    parentId: 'efs-excel',
    kind: 'excel',
    description:
      'VBA shed fire strategy workbook — External Spread tab for BR 187 / BRE numbers (documented in app/external-firespread/REFERENCE.md).',
    aliases: [
      'input_sheet_and_tables_v6',
      'input_sheet_and_tables_v6.xlsm',
      'xlsm',
      'vba shed',
      'br 187 excel',
      'br187',
      'bre 135',
    ],
    phrases: ['excel efs', 'shed fire strategy workbook'],
    path: 'Fire Dynamics Group Dropbox/07 Technical Tools/4. Clever Ideas - External/VBA Shed Fire Strategy/version 5/input_sheet_and_tables_v6.xlsm',
    openHint:
      'Open from Dropbox: 07 Technical Tools / 4. Clever Ideas - External / VBA Shed Fire Strategy / version 5 / input_sheet_and_tables_v6.xlsm. Use the External Spread tab.',
    icon: '📗',
    legacy: true,
    calcSourceIds: ['br-187', 'bre-135'],
  },
  {
    id: 'efs-desktop-gui',
    name: 'External Fire Spread desktop GUI',
    part: 'main_efs_gui.py',
    partKey: 'gui-tab6',
    parentTool: 'External Fire Spread desktop GUI',
    parentId: 'efs-desktop',
    kind: 'desktop',
    description:
      'Original tkinter EFS app. Tab 6 is External Fire Spread (BRE 135) — documented in app/external-firespread/REFERENCE.md.',
    aliases: ['main_efs_gui', 'efs gui', 'tkinter efs', 'bre 135', 'bre135', 'br 187'],
    phrases: ['desktop efs gui', 'python efs gui'],
    path: 'C:\\Users\\IanShaw\\localProgramming\\fd\\external_firespread',
    openHint:
      'Run main_efs_gui.py in localProgramming/fd/external_firespread. Tab 6 is External Fire Spread (BRE 135).',
    icon: '🖥️',
    legacy: true,
    calcSourceIds: ['bre-135', 'br-187'],
  },
  {
    id: 'warehouse-smoke-python',
    name: 'Warehouse Smoke Layer (Python)',
    part: 'warehouse_smoke_layer.py',
    partKey: 'python-script',
    parentTool: 'Warehouse Smoke Layer',
    parentId: 'warehouse-smoke',
    kind: 'desktop',
    description:
      'Original Python smoke-layer script (documented in app/warehouse-smoke/REFERENCE.md).',
    aliases: ['warehouse_smoke_layer.py', 'shedzone', 'base warehouse smoke depth'],
    phrases: ['python warehouse smoke', 'smoke layer script'],
    path: 'Fire Dynamics Group Dropbox/07 Technical Tools/1. Internal/Base Warehouse Smoke Depth/warehouse_smoke_layer.py',
    openHint:
      'Open Dropbox: 07 Technical Tools / 1. Internal / Base Warehouse Smoke Depth / warehouse_smoke_layer.py (Whole_Layer_Assumption is the model shipped in the web tool).',
    icon: '🐍',
    legacy: true,
  },
];

/**
 * Placeholder for a later Dropbox EXEs inventory. Do not add guessed/fake
 * entries. Schema already accepts kind 'exe' | 'dropbox' | 'desktop'.
 */
export const legacyTools: ToolPart[] = [
  // TODO: inventory Dropbox EXEs / legacy desktop tools later.
];

export const ALL_TOOLS: ToolPart[] = [...CATALOGUE, ...legacyTools];

export function dashboardCards(tools: ToolPart[] = ALL_TOOLS): ToolPart[] {
  return tools.filter((tool) => tool.showOnDashboard && !tool.shelved);
}

export function partLabel(tool: ToolPart): string {
  if (tool.partKey) {
    return `${tool.parentTool} → ${tool.part}`;
  }
  return tool.dashboardTitle || tool.name;
}

/** Primary CTA copy for a part. Layouts should use this so prototypes stay consistent. */
export function ctaLabel(tool: ToolPart): string {
  if (tool.partKey) return `Open in ${tool.part} mode`;
  const url = tool.deepLink || tool.url;
  if (url?.startsWith('/')) return 'Open';
  if (url) return 'Open App';
  return 'How to open';
}

export const TOOL_KINDS: ToolKind[] = [
  'web',
  'excel',
  'desktop',
  'mobile',
  'addin',
  'exe',
  'dropbox',
];
