// Decides whether linking a Synergy project may set the document Title.
// A non-empty Title is left alone unless it is the last value this add-in wrote. That
// last value is stored in the custom document property `fdgFeeProposalTitle`. Custom
// properties hold at most 255 characters, so a longer name is stored in a custom XML
// part and the property is set to a sentinel that a sanitised filename cannot equal
// (sanitising removes colons).

export const FEE_PROPOSAL_TITLE_PROPERTY = 'fdgFeeProposalTitle';
export const CUSTOM_PROPERTY_MAX = 255;
export const LONG_TITLE_SENTINEL = 'fdg:long';
export const FEE_PROPOSAL_TITLE_NS = 'urn:fdg:word-addin:fee-proposal-title';

export interface TrackedTitle {
  currentTitle: string;
  /** Custom property value, or null when the property is absent. */
  customProperty: string | null;
  /** Decoded long title from the custom XML part, or null when that part is absent. */
  customXml: string | null;
}

export interface TitleUpdate {
  /** New built-in Title, or null to leave it. */
  title: string | null;
  /** Custom property value to store, or null to leave it. */
  customProperty: string | null;
  /** String writes the XML part, null deletes it, undefined leaves it. */
  customXml: string | null | undefined;
}

const UNCHANGED: TitleUpdate = { title: null, customProperty: null, customXml: undefined };

export function lastAddinTitle(tracked: Pick<TrackedTitle, 'customProperty' | 'customXml'>): string | null {
  const property = tracked.customProperty?.trim() || null;
  if (property === LONG_TITLE_SENTINEL) return tracked.customXml?.trim() || null;
  if (property) return property;
  return tracked.customXml?.trim() || null;
}

export function planFeeProposalTitle(tracked: TrackedTitle, suggested: string): TitleUpdate {
  const next = suggested.trim();
  if (!next) return { ...UNCHANGED };

  const current = tracked.currentTitle.trim();
  const last = lastAddinTitle(tracked);
  const owned = last != null && current === last;
  if (current !== '' && !owned) return { ...UNCHANGED };

  const title = current === next ? null : next;
  if (last === next) return { title, customProperty: null, customXml: undefined };

  if (next.length <= CUSTOM_PROPERTY_MAX) {
    return {
      title,
      customProperty: tracked.customProperty === next ? null : next,
      customXml: tracked.customXml != null ? null : undefined,
    };
  }

  return {
    title,
    customProperty: tracked.customProperty === LONG_TITLE_SENTINEL ? null : LONG_TITLE_SENTINEL,
    customXml: tracked.customXml === next ? undefined : next,
  };
}

export interface FeeProposalTitleStore {
  read(): Promise<TrackedTitle>;
  write(update: TitleUpdate): Promise<void>;
}

export function titleUpdateChanges(update: TitleUpdate): boolean {
  return update.title != null || update.customProperty != null || update.customXml !== undefined;
}

export async function syncFeeProposalDocumentTitle(store: FeeProposalTitleStore, suggested: string): Promise<TitleUpdate> {
  const update = planFeeProposalTitle(await store.read(), suggested);
  if (titleUpdateChanges(update)) await store.write(update);
  return update;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unescapeXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export function feeProposalTitleXml(title: string): string {
  return `<fdg:title xmlns:fdg="${FEE_PROPOSAL_TITLE_NS}">${escapeXml(title)}</fdg:title>`;
}

export function parseFeeProposalTitleXml(xml: string | null | undefined): string | null {
  if (!xml) return null;
  const match = /<fdg:title\b[^>]*>([\s\S]*)<\/fdg:title>/.exec(xml);
  if (!match) return null;
  return unescapeXml(match[1]);
}
