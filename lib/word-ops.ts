/* eslint-disable @typescript-eslint/no-explicit-any */
// Everything the pane does to the open document, through Office.js (Word JS API).
// Office.js is loaded by the page from the Microsoft CDN; these globals exist only inside
// an Office host, so every function here must be called after officeReady() resolved.

declare const Word: any;
declare const Office: any;

import type { Proposal } from './word-addin-api';

export const SECTION_TAG_PREFIX = 'fdg:section:';
export const REFERENCES_TAG = 'fdg:references';

export type ApplyStrategy = 'rebuild' | 'adopt';

export interface ParagraphText {
  index: number;
  text: string;
}

export interface ApplyReport {
  inserted: number;
  anchorsMissed: number;
  order: string[];
  adopted: number;
}

/** Resolves true inside Word, false in a plain browser (preview mode). */
export function officeReady(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Office === 'undefined') {
      resolve(false);
      return;
    }
    Office.onReady((info: { host: unknown }) => resolve(info.host === Office.HostType.Word));
  });
}

export function isSetSupported(name: string, version: string): boolean {
  try {
    return Office.context.requirements.isSetSupported(name, version);
  } catch {
    return false;
  }
}

export async function newDocumentFromBase64(base64: string): Promise<void> {
  await Word.run(async (ctx: any) => {
    const created = ctx.application.createDocument(base64);
    await ctx.sync();
    created.open();
    await ctx.sync();
  });
}

/** Insert a docx fragment at the cursor, wrapped in a content control tagged for regeneration. */
export async function insertSectionAtCursor(base64: string, sectionId: string, title: string): Promise<void> {
  await Word.run(async (ctx: any) => {
    const selection = ctx.document.getSelection();
    const range = selection.insertFileFromBase64(base64, 'After');
    await ctx.sync();
    try {
      const cc = range.insertContentControl();
      cc.tag = SECTION_TAG_PREFIX + sectionId;
      cc.title = title;
      cc.appearance = 'BoundingBox';
      await ctx.sync();
    } catch {
      // Wrapping failed (e.g. the inserted range spans a table boundary Word won't wrap);
      // the content is in, just not regenerable.
    }
  });
}

/** Replace the contents of an existing tagged section. Returns false if none exists. */
export async function regenerateSection(base64: string, sectionId: string): Promise<boolean> {
  let found = false;
  await Word.run(async (ctx: any) => {
    const controls = ctx.document.contentControls.getByTag(SECTION_TAG_PREFIX + sectionId);
    controls.load('items');
    await ctx.sync();
    if (controls.items.length === 0) return;
    controls.items[0].insertFileFromBase64(base64, 'Replace');
    await ctx.sync();
    found = true;
  });
  return found;
}

export async function listSectionTags(): Promise<string[]> {
  const tags: string[] = [];
  await Word.run(async (ctx: any) => {
    const controls = ctx.document.contentControls;
    controls.load('items/tag');
    await ctx.sync();
    for (const cc of controls.items) if (cc.tag) tags.push(cc.tag);
  });
  return tags;
}

/** Body paragraphs up to (not including) the References heading, with their indices. */
export async function readBodyParagraphs(): Promise<ParagraphText[]> {
  const out: ParagraphText[] = [];
  await Word.run(async (ctx: any) => {
    const paragraphs = ctx.document.body.paragraphs;
    paragraphs.load('items/text');
    await ctx.sync();
    for (let i = 0; i < paragraphs.items.length; i++) {
      const text: string = paragraphs.items[i].text;
      if (text.trim() === 'References') break;
      if (text.trim()) out.push({ index: i, text });
    }
  });
  return out;
}

export interface ExistingReferences {
  headingIndex: number | null;
  entries: { index: number; text: string }[];
  native: boolean;
}

/**
 * What the open document already has under its References heading. An entry is either a
 * typed "[n] ..." paragraph or a paragraph carrying a ref_* bookmark (one we wrote earlier).
 */
export async function readExistingReferences(): Promise<ExistingReferences> {
  const result: ExistingReferences = { headingIndex: null, entries: [], native: false };
  await Word.run(async (ctx: any) => {
    const paragraphs = ctx.document.body.paragraphs;
    paragraphs.load('items/text');
    const controls = ctx.document.contentControls.getByTag(REFERENCES_TAG);
    controls.load('items');
    await ctx.sync();
    const wrapped = controls.items.length > 0;
    const items = paragraphs.items;
    const h = items.findIndex((p: any) => p.text.trim() === 'References');
    if (h < 0) return;
    result.headingIndex = h;
    // Bookmarks per candidate paragraph, fetched in one round trip.
    const end = Math.min(items.length, h + 60);
    const marks: { j: number; res: any }[] = [];
    for (let j = h + 1; j < end; j++) marks.push({ j, res: items[j].getRange().getBookmarks(true, false) });
    await ctx.sync();
    for (const { j, res } of marks) {
      const t: string = items[j].text.trim();
      const hasRef = (res.value as string[]).some((b) => b.startsWith('ref_'));
      if (!t && !hasRef) continue;
      if (/^\[\d+\]/.test(t) || hasRef || (wrapped && t)) {
        result.entries.push({ index: j, text: t });
        if (hasRef) result.native = true;
      } else break;
    }
    if (wrapped) result.native = true;
  });
  return result;
}

function firstCitationOrder(proposals: Proposal[], paragraphs: ParagraphText[]): string[] {
  const textByIndex = new Map(paragraphs.map((p) => [p.index, p.text]));
  const keyed = proposals.map((p) => {
    const text = textByIndex.get(p.paragraph) ?? '';
    const at = p.anchor ? text.indexOf(p.anchor) : -1;
    return { p, pos: at < 0 ? text.length : at + p.anchor.length };
  });
  keyed.sort((a, b) => a.p.paragraph - b.p.paragraph || a.pos - b.pos);
  const order: string[] = [];
  for (const k of keyed) if (!order.includes(k.p.source_id)) order.push(k.p.source_id);
  return order;
}

/**
 * Write citations natively. Rebuild: one bookmarked numbered list (fragment from the backend)
 * in first-citation order, existing typed marks removed. Adopt: the existing list keeps its
 * numbers; entries already present get a bookmark on their "[n]" prefix, new sources are
 * appended as typed entries, and every citation is a REF field either way.
 */
export async function applyCitations(
  proposals: Proposal[],
  paragraphs: ParagraphText[],
  strategy: ApplyStrategy,
  renderReferences: (order: string[]) => Promise<string>,
  matchEntries: (entries: string[]) => Promise<{ entry: string; source_id: string | null }[]>,
  entryText: (sourceId: string) => string,
): Promise<ApplyReport> {
  const report: ApplyReport = { inserted: 0, anchorsMissed: 0, order: [], adopted: 0 };
  const existing = await readExistingReferences();
  const order = firstCitationOrder(proposals, paragraphs);

  // Which bookmark each source resolves to, and whether the field shows a list number (\r)
  // or the bookmarked text (typed "[n]" prefix under Adopt).
  const useListNumber = new Map<string, boolean>();

  if (strategy === 'adopt' && existing.headingIndex !== null && existing.entries.length && !existing.native) {
    const matched = await matchEntries(existing.entries.map((e) => e.text));
    const present = new Map<string, number>(); // source -> paragraph index of its entry
    matched.forEach((m, i) => {
      if (m.source_id) present.set(m.source_id, existing.entries[i].index);
    });
    const lastNumber = Math.max(0, ...existing.entries.map((e) => parseInt((e.text.match(/^\[(\d+)\]/) || [])[1] || '0', 10)));
    await Word.run(async (ctx: any) => {
      const paragraphs = ctx.document.body.paragraphs;
      paragraphs.load('items/text');
      await ctx.sync();
      // Bookmark the "[n]" prefix of every matched entry so REF fields can point at it.
      for (const [sid, idx] of present) {
        const p = paragraphs.items[idx];
        const hits = p.search('\\[[0-9]{1,3}\\]', { matchWildcards: true });
        hits.load('items');
        await ctx.sync();
        if (hits.items.length) {
          hits.items[0].insertBookmark(`ref_${sid}`);
          useListNumber.set(sid, false);
          report.adopted += 1;
        }
      }
      // Append the sources the document does not have yet, typed in the same style.
      let n = lastNumber;
      let last = paragraphs.items[existing.entries[existing.entries.length - 1].index];
      for (const sid of order) {
        if (present.has(sid)) continue;
        n += 1;
        const p = last.insertParagraph(`[${n}] ${entryText(sid)}`, 'After');
        const hits = p.search(`[${n}]`, { matchCase: true });
        hits.load('items');
        await ctx.sync();
        if (hits.items.length) hits.items[0].insertBookmark(`ref_${sid}`);
        useListNumber.set(sid, false);
        last = p;
      }
      await ctx.sync();
    });
    report.order = [...present.keys(), ...order.filter((s) => !present.has(s))];
  } else {
    // Rebuild: fragment with bookmarked numbered entries under the heading.
    const fragment = await renderReferences(order);
    await Word.run(async (ctx: any) => {
      const body = ctx.document.body;
      const controls = ctx.document.contentControls.getByTag(REFERENCES_TAG);
      controls.load('items');
      await ctx.sync();
      if (controls.items.length) {
        controls.items[0].insertFileFromBase64(fragment, 'Replace');
        await ctx.sync();
      } else {
        const paragraphs = body.paragraphs;
        paragraphs.load('items/text');
        await ctx.sync();
        let heading = existing.headingIndex !== null ? paragraphs.items[existing.headingIndex] : null;
        // Old typed entries go (highest index first so earlier proxies stay valid).
        for (const e of [...existing.entries].reverse()) paragraphs.items[e.index].delete();
        if (!heading) {
          heading = body.insertParagraph('References', 'End');
          try {
            heading.style = 'Main Headd';
          } catch {
            heading.styleBuiltIn = Word.Style.heading1;
          }
        }
        // The fragment's last (empty) paragraph merges into this holder, so give the
        // holder a plain style rather than the heading's.
        const holder = heading.insertParagraph('', 'After');
        holder.styleBuiltIn = Word.Style.normal;
        const range = holder.insertFileFromBase64(fragment, 'Replace');
        await ctx.sync();
        try {
          const cc = range.insertContentControl();
          cc.tag = REFERENCES_TAG;
          cc.title = 'References';
          await ctx.sync();
        } catch {
          // Not wrapped; the next rebuild falls back to the heading scan.
        }
      }
    });
    for (const sid of order) useListNumber.set(sid, true);
    report.order = order;
  }

  // Citations: strip old typed marks in touched paragraphs, then insert REF fields.
  await Word.run(async (ctx: any) => {
    const paragraphs = ctx.document.body.paragraphs;
    paragraphs.load('items');
    await ctx.sync();
    const byParagraph = new Map<number, Proposal[]>();
    for (const p of proposals) byParagraph.set(p.paragraph, [...(byParagraph.get(p.paragraph) || []), p]);
    for (const [idx, items] of byParagraph) {
      const para = paragraphs.items[idx];
      if (strategy === 'rebuild') {
        const marks = para.search('\\[[0-9]{1,3}\\]', { matchWildcards: true });
        marks.load('items');
        await ctx.sync();
        for (const m of marks.items) m.delete();
        await ctx.sync();
      }
      for (const p of items) {
        let target: any = null;
        if (p.anchor) {
          const hits = para.search(p.anchor.slice(0, 250), { matchCase: false });
          hits.load('items');
          await ctx.sync();
          if (hits.items.length) target = hits.items[0];
        }
        const code = useListNumber.get(p.source_id) === false ? `ref_${p.source_id} \\h` : `ref_${p.source_id} \\r \\h`;
        let field: any;
        if (target) field = target.insertField('After', 'Ref', code, false);
        else {
          report.anchorsMissed += 1;
          field = para.getRange('Content').insertField('End', 'Ref', code, false);
        }
        await ctx.sync();
        report.inserted += 1;
        // Superscript on the code too: a REF result takes the formatting of the code's
        // first character when the field updates.
        try {
          field.result.font.superscript = true;
          field.code.font.superscript = true;
          await ctx.sync();
        } catch {
          /* leave the field unformatted rather than fail the run */
        }
      }
    }
    await ctx.sync();
    const fields = ctx.document.body.fields;
    fields.load('items');
    await ctx.sync();
    for (const f of fields.items) f.updateResult();
    await ctx.sync();
  });
  return report;
}

// --- state stored inside the document ------------------------------------------------
// A custom XML part per key (namespace urn:fdg:word-addin:<key>) holds the JSON that
// produced a section, so reopening the file restores the pane's form and Regenerate has
// something to regenerate from. Custom document properties are capped at 255 characters,
// which rules them out for a whole fee form.

const STATE_NS_PREFIX = 'urn:fdg:word-addin:';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function saveDocumentState(key: string, value: unknown): Promise<void> {
  const ns = STATE_NS_PREFIX + key;
  await Word.run(async (ctx: any) => {
    const existing = ctx.document.customXmlParts.getByNamespace(ns);
    existing.load('items');
    await ctx.sync();
    for (const part of existing.items) part.delete();
    ctx.document.customXmlParts.add(`<fdg:state xmlns:fdg="${ns}">${escapeXml(JSON.stringify(value))}</fdg:state>`);
    await ctx.sync();
  });
}

export async function loadDocumentState<T>(key: string): Promise<T | null> {
  const ns = STATE_NS_PREFIX + key;
  let result: T | null = null;
  await Word.run(async (ctx: any) => {
    const parts = ctx.document.customXmlParts.getByNamespace(ns);
    parts.load('items');
    await ctx.sync();
    if (parts.items.length === 0) return;
    const xml = parts.items[0].getXml();
    await ctx.sync();
    const m = /<fdg:state[^>]*>([\s\S]*)<\/fdg:state>/.exec(xml.value);
    if (!m) return;
    const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    result = JSON.parse(text) as T;
  });
  return result;
}

export async function updateAllFields(): Promise<number> {
  let n = 0;
  await Word.run(async (ctx: any) => {
    const fields = ctx.document.body.fields;
    fields.load('items');
    await ctx.sync();
    for (const f of fields.items) f.updateResult();
    n = fields.items.length;
    await ctx.sync();
  });
  return n;
}
