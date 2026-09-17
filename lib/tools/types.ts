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
}

export type SearchMode = 'browse' | 'keyword' | 'intent';
export type Confidence = 'none' | 'low' | 'medium' | 'high';

export interface ToolSuggestion {
  part: ToolPart;
  label: string;
  why: string;
}

export interface ToolSearchResult {
  query: string;
  matches: ToolPart[];
  suggestion: ToolSuggestion | null;
  confidence: Confidence;
  mode: SearchMode;
}
