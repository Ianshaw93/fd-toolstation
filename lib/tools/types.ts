export type ToolKind =
  | 'web'
  | 'excel'
  | 'desktop'
  | 'mobile'
  | 'addin'
  | 'exe'
  | 'dropbox';

export type UploadCanvasMode = 'fdsGen' | 'radiation' | 'timeEq' | 'efs';

export interface ToolPart {
  id: string;
  name: string;
  part: string;
  partKey?: string;
  parentTool: string;
  parentId: string;
  kind: ToolKind;
  description: string;
  aliases: string[];
  phrases: string[];
  deepLink?: string;
  openHint?: string;
  path?: string;
  icon?: string;
  url?: string;
  showOnDashboard?: boolean;
  dashboardTitle?: string;
  dashboardDescription?: string;
  shelved?: boolean;
  liveStatus?: 'cfd';
  hasLaunchButton?: boolean;
  hasInstructions?: boolean;
  wip?: boolean;
  /** Original Excel/desktop/python superseded by a shipped web tool. Hidden unless the query asks for it. */
  legacy?: boolean;
  /** Ids into CALC_SOURCES — only citations mined from code/REFERENCE. */
  calcSourceIds?: string[];
}

export type SearchMode = 'browse' | 'keyword' | 'intent';
export type Confidence = 'none' | 'low' | 'medium' | 'high';

export interface ToolSuggestion {
  part: ToolPart;
  label: string;
  why: string;
  /** Query-overlapping calc/standard line, or null when this was a name-only hit. */
  basedOn: string | null;
}

export interface ToolSearchResult {
  query: string;
  matches: ToolPart[];
  suggestion: ToolSuggestion | null;
  confidence: Confidence;
  mode: SearchMode;
  /** part id → “Based on …” line for sources that overlap this query. */
  basedOn: Record<string, string>;
}
