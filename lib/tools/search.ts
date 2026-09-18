import { ALL_TOOLS, partLabel } from './catalogue';
import type { Confidence, SearchMode, ToolPart, ToolSearchResult, ToolSuggestion } from './types';

/**
 * Homepage tool search — lexical rank + intent, adapted from the email-search
 * retrieval approach (tokenise, synonym expansion, typeahead prefixes,
 * field-weighted scoring, score-gap confidence). A remote embedding call is
 * skipped here so the dashboard stays instant; the catalogue is small enough
 * that synonym-expanded lexical rank is the right latency tradeoff.
 */

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'for',
  'to',
  'of',
  'and',
  'or',
  'in',
  'on',
  'at',
  'i',
  'im',
  'me',
  'my',
  'where',
  'that',
  'this',
  'with',
  'from',
  'tool',
  'tools',
  'app',
  'please',
  'looking',
  'want',
  'need',
  'use',
  'using',
  'into',
  'over',
  'be',
  'is',
  'it',
  'as',
]);

const SYNONYM_GROUPS: string[][] = [
  ['efs', 'external fire spread', 'external-firespread', 'external firespread', 'firespread'],
  ['br', 'bre', 'bre 135', 'bre135', 'bre-135', 'br 187', 'br187', 'br-187'],
  ['bs 7974', 'pd 7974', '7974', '7974-1', '7974-6', 'pd 7974-1', 'bs 7974-6', 'pd 7974-6'],
  ['cibse', 'cibse guide e', 'guide e'],
  ['drysdale', 'introduction to fire dynamics'],
  ['en 1991', 'en1991', 'eurocode', 'eurocode 1', 'ec1', 'ec1 annex a'],
  ['pd 6688', '6688'],
  ['aset', 'available safe egress time'],
  ['rset', 'required safe egress time'],
  ['mail marshal', 'email search', 'emails', 'search and rescue', 'search & rescue'],
  ['site right', 'site visit', 'site-right'],
  ['canvas', 'markup', 'upload canvas', 'pdf markup', 'annotation'],
  ['time eq', 'time equivalence', 'timeeq', 'time-eq', 'time-equivalence'],
  ['fds', 'fds gen', 'fdsgen', 'fds generation'],
  ['sprinkler', 'sprinklers'],
  ['fee proposal', 'fee', 'fees'],
  ['draw', 'drawing', 'drawn', 'annotate'],
  ['plan', 'plans'],
];

const LEGACY_QUERY_TOKENS = [
  'python',
  'excel',
  'xlsm',
  'vba',
  'dropbox',
  'script',
  'tkinter',
  'exe',
  'desktop',
  'gui',
];

type IntentRule = {
  partId: string;
  weight: number;
  all: string[][];
};

const INTENT_RULES: IntentRule[] = [
  {
    partId: 'upload-canvas-efs',
    weight: 90,
    all: [
      ['draw', 'drawing', 'markup', 'canvas', 'annotate', 'upload', 'pin'],
      ['plan', 'plans', 'elevation', 'pdf', 'warehouse'],
      ['efs', 'external', 'spread', 'firespread'],
    ],
  },
  {
    partId: 'efs-calculator',
    weight: 70,
    all: [
      ['bre', 'bre135', 'calculator', 'assessment', 'numbers'],
      ['efs', 'external', 'spread', 'firespread', 'bre', 'bre135', 'elevation'],
    ],
  },
  {
    partId: 'warehouse-smoke',
    weight: 55,
    all: [['warehouse', 'shed', 'smoke', '7974', 'cibse', 'drysdale'], ['smoke', 'aset', 'rset', 'layer', 'tenability', '7974', 'cibse', 'drysdale']],
  },
  {
    partId: 'site-visit-report',
    weight: 50,
    all: [['site'], ['visit', 'right', 'report', 'pin', 'pins', 'a3']],
  },
  {
    partId: 'sprinkler-grid',
    weight: 50,
    all: [['sprinkler', 'sprinklers'], ['grid', 'sprinkler', 'sprinklers', 'coverage']],
  },
  {
    partId: 'fee-proposal',
    weight: 50,
    all: [['fee', 'fees'], ['proposal', 'quote', 'letter', 'word']],
  },
  {
    partId: 'search-rescue',
    weight: 50,
    all: [['email', 'emails', 'mail', 'marshal', 'rescue'], ['search', 'marshal', 'email', 'emails']],
  },
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[_./-]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

export function compactAlnum(text: string): string {
  return normalize(text).replace(/\s+/g, '');
}

export function contentTokens(text: string): string[] {
  return tokenize(text).filter((token) => !STOPWORDS.has(token) && token.length > 1);
}

function synonymGroupHits(group: string[], tokens: string[], joined: string): boolean {
  return group.some((term) => {
    const termTokens = tokenize(term);
    if (termTokens.length === 0) return false;
    if (termTokens.every((termToken) => tokens.includes(termToken))) return true;
    if (joined.includes(normalize(term))) return true;
    return tokens.some(
      (queryToken) =>
        queryToken.length >= 3 &&
        termTokens.some((termToken) => termToken.startsWith(queryToken) && termToken.length > queryToken.length),
    );
  });
}

export function expandTokens(tokens: string[]): Set<string> {
  const expanded = new Set(tokens);
  const joined = tokens.join(' ');
  for (const group of SYNONYM_GROUPS) {
    if (!synonymGroupHits(group, tokens, joined)) continue;
    const singletons = new Set(
      group.flatMap((term) => {
        const termTokens = tokenize(term);
        return termTokens.length === 1 ? termTokens : [];
      }),
    );
    for (const term of group) {
      expanded.add(normalize(term));
      const compact = compactAlnum(term);
      if (compact.length >= 2) expanded.add(compact);
      for (const termToken of tokenize(term)) {
        const distinctive = singletons.has(termToken) || tokens.includes(termToken) || /\d/.test(termToken);
        if (!distinctive) continue;
        if (termToken.length >= 3 || tokens.includes(termToken)) expanded.add(termToken);
      }
    }
  }
  return expanded;
}

function isNaturalLanguage(query: string): boolean {
  return contentTokens(query).length >= 4;
}

function fieldText(part: ToolPart): {
  title: string;
  part: string;
  aliases: string;
  aliasList: string[];
  description: string;
  phrases: string;
  path: string;
  words: string[];
} {
  const title = normalize(`${part.dashboardTitle ?? ''} ${part.name}`);
  const partName = normalize(part.part);
  const aliasList = part.aliases;
  const aliases = normalize(part.aliases.join(' '));
  const description = normalize(part.description);
  const phrases = normalize(part.phrases.join(' '));
  const path = normalize(`${part.path ?? ''} ${part.openHint ?? ''} ${part.partKey ?? ''}`);
  const words = tokenize(`${title} ${partName} ${aliases} ${description} ${phrases} ${path}`);
  return { title, part: partName, aliases, aliasList, description, phrases, path, words };
}

function phraseOverlap(queryTokens: string[], phrase: string): number {
  const phraseTokens = contentTokens(phrase);
  if (phraseTokens.length === 0) return 0;
  const hits = phraseTokens.filter((token) => queryTokens.includes(token)).length;
  return hits / phraseTokens.length;
}

function hasAny(haystack: Set<string>, needles: string[]): boolean {
  return needles.some((needle) => haystack.has(needle) || [...haystack].some((item) => item.includes(needle)));
}

function intentBoost(partId: string, expanded: Set<string>): number {
  let boost = 0;
  for (const rule of INTENT_RULES) {
    if (rule.partId !== partId) continue;
    if (rule.all.every((group) => hasAny(expanded, group))) {
      boost += rule.weight;
    }
  }
  return boost;
}

function hasDrawOnPlansIntent(expanded: Set<string>): boolean {
  const draw = hasAny(expanded, ['draw', 'drawing', 'markup', 'annotate', 'canvas']);
  const plans = hasAny(expanded, ['plan', 'plans']);
  const efs = hasAny(expanded, ['efs', 'external', 'spread', 'firespread']);
  return draw && plans && efs;
}

/** Calculator-numbers intent from the typed query, not from br→bre synonym expansion. */
function hasCalculatorIntent(queryTokens: string[]): boolean {
  const tokens = new Set(queryTokens);
  if (hasAny(tokens, ['calculator', 'assessment', 'numbers'])) return true;
  if (tokens.has('bre135')) return true;
  if (tokens.has('bre') && tokens.has('135')) return true;
  if (tokens.has('br') && tokens.has('187')) return true;
  return false;
}

function queryWantsLegacy(query: string, expanded: Set<string>): boolean {
  if (/\.(py|xlsm|xlsx|xls|exe)\b/i.test(query)) return true;
  return hasAny(expanded, LEGACY_QUERY_TOKENS);
}

function legacyHasDistinctiveHit(part: ToolPart, expanded: Set<string>): boolean {
  const parentWords = new Set(tokenize(part.parentTool));
  const distinctive = tokenize(`${part.aliases.join(' ')} ${part.part}`);
  for (const token of expanded) {
    if (token.length < 2) continue;
    if (parentWords.has(token)) continue;
    if (distinctive.some((word) => word === token || word.startsWith(token))) return true;
  }
  return false;
}

function textHasPrefix(field: string, query: string): boolean {
  const q = normalize(query);
  if (q.length < 2) return false;
  const words = tokenize(field);
  if (words.some((word) => word === q || word.startsWith(q))) return true;
  const compactField = compactAlnum(field);
  const compactQuery = compactAlnum(query);
  return compactQuery.length >= 2 && (compactField === compactQuery || compactField.startsWith(compactQuery));
}

function aliasesHavePrefix(aliases: string[], query: string): boolean {
  return aliases.some((alias) => textHasPrefix(alias, query));
}

function scorePart(query: string, queryTokens: string[], expanded: Set<string>, part: ToolPart): number {
  if (part.shelved) return 0;
  if (part.legacy && !queryWantsLegacy(query, expanded) && !legacyHasDistinctiveHit(part, expanded)) {
    return 0;
  }

  const fields = fieldText(part);
  const normalisedQuery = normalize(query);
  let score = 0;

  if (textHasPrefix(fields.title, normalisedQuery)) score += 22;
  if (textHasPrefix(fields.part, normalisedQuery)) score += 20;
  if (aliasesHavePrefix(fields.aliasList, normalisedQuery)) score += 18;
  if (normalisedQuery.length >= 4 && textHasPrefix(fields.description, normalisedQuery)) score += 12;
  if (normalisedQuery.length >= 4 && textHasPrefix(fields.phrases, normalisedQuery)) score += 28;
  if (normalisedQuery.length >= 5 && textHasPrefix(fields.path, normalisedQuery)) score += 16;

  for (const token of expanded) {
    if (token.length < 2) continue;
    if (fields.title.split(' ').includes(token)) score += 9;
    else if (fields.part.split(' ').includes(token)) score += 8;
    else if (fields.aliases.split(' ').includes(token)) score += 7;
    else if (fields.phrases.split(' ').includes(token)) score += 6;
    else if (fields.description.split(' ').includes(token)) score += 3;
    else if (fields.path.split(' ').includes(token)) score += 4;
    else if (token.length >= 3 && fields.words.some((word) => word.startsWith(token))) score += 5;
    else if (token.includes(' ') && `${fields.title} ${fields.aliases} ${fields.phrases}`.includes(token)) {
      score += 10;
    } else if (fields.aliasList.some((alias) => compactAlnum(alias).startsWith(compactAlnum(token)))) {
      score += 6;
    }
  }

  for (const phrase of part.phrases) {
    const overlap = phraseOverlap(queryTokens, phrase);
    if (overlap === 1) score += 32;
    else if (overlap >= 0.7) score += 18;
  }

  score += intentBoost(part.id, expanded);

  if (part.id === 'upload-canvas-efs' && hasDrawOnPlansIntent(expanded)) {
    score += 40;
  }
  if (part.id === 'efs-calculator' && hasDrawOnPlansIntent(expanded)) {
    score -= 50;
  }
  if (part.id === 'warehouse-smoke' && hasDrawOnPlansIntent(expanded)) {
    score -= 40;
  }
  if (part.id === 'upload-canvas-efs' && hasCalculatorIntent(queryTokens) && !hasDrawOnPlansIntent(expanded)) {
    score -= 35;
  }

  if (score > 0 && part.kind === 'web' && !queryWantsLegacy(query, expanded)) {
    score += 8;
  }

  return score;
}

type Ranked = { part: ToolPart; score: number };

/** Only collapse generic shells (Upload Canvas) when a mode-part is already shown. */
const SHELL_PARENT_IDS = new Set(['upload-canvas']);

function collapseParents(ranked: Ranked[]): Ranked[] {
  const parentsWithParts = new Set(
    ranked
      .filter((row) => row.part.partKey && SHELL_PARENT_IDS.has(row.part.parentId))
      .map((row) => row.part.parentId),
  );
  return ranked.filter((row) => row.part.partKey || !parentsWithParts.has(row.part.id));
}

function whyFor(part: ToolPart): string {
  if (part.partKey === 'efs') {
    return 'On the Upload Canvas dev app, choose Mode → External Fire Spread. Production does not have this mode yet.';
  }
  return part.description;
}

function suggestionFor(
  ranked: Ranked[],
  mode: SearchMode,
  confidence: Confidence,
): ToolSuggestion | null {
  if (ranked.length === 0) return null;
  if (mode !== 'intent' && confidence === 'low') return null;
  const top = ranked[0].part;
  return {
    part: top,
    label: partLabel(top),
    why: whyFor(top),
  };
}

function confidenceFor(ranked: Ranked[], mode: SearchMode): Confidence {
  if (ranked.length === 0) return 'none';
  const top = ranked[0].score;
  const second = ranked[1]?.score ?? 0;
  const gap = second > 0 ? top / second : Number.POSITIVE_INFINITY;
  if (gap >= 1.4 || top >= 80) return 'high';
  if (mode === 'intent' || gap >= 1.15 || top >= 40) return 'medium';
  return 'low';
}

export function searchTools(query: string, tools: ToolPart[] = ALL_TOOLS): ToolSearchResult {
  const trimmed = query.trim();
  const visible = tools.filter((tool) => !tool.shelved);

  if (!trimmed) {
    return {
      query: trimmed,
      matches: visible.filter((tool) => tool.showOnDashboard),
      suggestion: null,
      confidence: 'none',
      mode: 'browse',
    };
  }

  const queryTokens = contentTokens(trimmed);
  const expanded = expandTokens(queryTokens);
  const mode: SearchMode = isNaturalLanguage(trimmed) ? 'intent' : 'keyword';

  const ranked = visible
    .map((part) => ({ part, score: scorePart(trimmed, queryTokens, expanded, part) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const webRank = (part: ToolPart) => (part.kind === 'web' ? 0 : 1);
      return webRank(a.part) - webRank(b.part) || a.part.name.localeCompare(b.part.name);
    });

  const collapsed = collapseParents(ranked);
  const confidence = confidenceFor(collapsed, mode);

  return {
    query: trimmed,
    matches: collapsed.map((row) => row.part),
    suggestion: suggestionFor(collapsed, mode, confidence),
    confidence,
    mode,
  };
}

export function filterTools(query: string, tools: ToolPart[]): ToolPart[] {
  return searchTools(query, tools).matches;
}

export function isInternalUrl(url: string): boolean {
  return url.startsWith('/');
}

export function resolveOpenUrl(part: ToolPart): string | undefined {
  return part.deepLink || part.url;
}

export function navigateToTool(part: ToolPart, router: { push: (href: string) => void }): void {
  const url = resolveOpenUrl(part);
  if (!url) return;
  if (isInternalUrl(url)) {
    router.push(url);
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
