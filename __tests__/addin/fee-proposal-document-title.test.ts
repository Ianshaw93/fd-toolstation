import {
  CUSTOM_PROPERTY_MAX,
  FEE_PROPOSAL_TITLE_PROPERTY,
  LONG_TITLE_SENTINEL,
  feeProposalTitleXml,
  parseFeeProposalTitleXml,
  planFeeProposalTitle,
  syncFeeProposalDocumentTitle,
  type FeeProposalTitleStore,
  type TitleUpdate,
  type TrackedTitle,
} from '../../lib/fee-proposal-document-title';
import { buildFeeProposalFilename } from '../../lib/fee-proposal-filename';
import { applySuggestedDocumentTitle } from '../../lib/word-ops';

const FIRST = '0602 Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26';
const NEXT = '0701 Riverside School Fire Dynamics Group Fee Proposal 13-11-26';

function tracked(partial: Partial<TrackedTitle> = {}): TrackedTitle {
  return { currentTitle: '', customProperty: null, customXml: null, ...partial };
}

function memoryStore(initial: TrackedTitle): FeeProposalTitleStore & { current: TrackedTitle; writes: TitleUpdate[] } {
  const current: TrackedTitle = { ...initial };
  const writes: TitleUpdate[] = [];
  return {
    current,
    writes,
    async read() {
      return { ...current };
    },
    async write(update) {
      writes.push(update);
      if (update.title != null) current.currentTitle = update.title;
      if (update.customProperty != null) current.customProperty = update.customProperty;
      if (update.customXml === null) current.customXml = null;
      else if (typeof update.customXml === 'string') current.customXml = update.customXml;
    },
  };
}

describe('planFeeProposalTitle', () => {
  it('sets Title on a blank document and records the value the add-in wrote', () => {
    expect(planFeeProposalTitle(tracked(), FIRST)).toEqual({
      title: FIRST,
      customProperty: FIRST,
      customXml: undefined,
    });
  });

  it('treats a whitespace-only Title as blank', () => {
    expect(planFeeProposalTitle(tracked({ currentTitle: '   ' }), FIRST).title).toBe(FIRST);
  });

  it('replaces a Title this add-in wrote when the linked project changes', () => {
    expect(
      planFeeProposalTitle(tracked({ currentTitle: FIRST, customProperty: FIRST }), NEXT),
    ).toEqual({
      title: NEXT,
      customProperty: NEXT,
      customXml: undefined,
    });
  });

  it('does not write when the Title is already the suggestion the add-in recorded', () => {
    expect(planFeeProposalTitle(tracked({ currentTitle: `  ${FIRST}  `, customProperty: FIRST }), FIRST)).toEqual({
      title: null,
      customProperty: null,
      customXml: undefined,
    });
  });

  it('does not clobber a Title the user set to something else', () => {
    expect(
      planFeeProposalTitle(tracked({ currentTitle: 'Board minutes', customProperty: FIRST }), NEXT),
    ).toEqual({ title: null, customProperty: null, customXml: undefined });
    expect(planFeeProposalTitle(tracked({ currentTitle: 'Board minutes' }), FIRST)).toEqual({
      title: null,
      customProperty: null,
      customXml: undefined,
    });
  });

  it('does not take ownership of a Title the user typed that happens to match the suggestion', () => {
    expect(planFeeProposalTitle(tracked({ currentTitle: FIRST }), FIRST)).toEqual({
      title: null,
      customProperty: null,
      customXml: undefined,
    });
  });

  it('fills a Title the user cleared, including after the add-in had set one', () => {
    expect(planFeeProposalTitle(tracked({ currentTitle: '', customProperty: FIRST }), NEXT)).toEqual({
      title: NEXT,
      customProperty: NEXT,
      customXml: undefined,
    });
  });

  it('stores a title longer than a custom property in custom XML and a sentinel property', () => {
    const suggested = 'S'.repeat(CUSTOM_PROPERTY_MAX + 1);
    expect(planFeeProposalTitle(tracked(), suggested)).toEqual({
      title: suggested,
      customProperty: LONG_TITLE_SENTINEL,
      customXml: suggested,
    });
    expect(LONG_TITLE_SENTINEL.length).toBeLessThanOrEqual(CUSTOM_PROPERTY_MAX);
  });

  it('stores a 255-character title in the custom property itself', () => {
    const suggested = 'S'.repeat(CUSTOM_PROPERTY_MAX);
    expect(planFeeProposalTitle(tracked(), suggested)).toEqual({
      title: suggested,
      customProperty: suggested,
      customXml: undefined,
    });
  });

  it('reads a long title back from XML and can replace it with a short one', () => {
    const longTitle = 'L'.repeat(CUSTOM_PROPERTY_MAX + 20);
    const update = planFeeProposalTitle(
      tracked({ currentTitle: longTitle, customProperty: LONG_TITLE_SENTINEL, customXml: longTitle }),
      FIRST,
    );
    expect(update).toEqual({ title: FIRST, customProperty: FIRST, customXml: null });
  });

  it('prefers the custom property over a stale XML copy when deciding ownership', () => {
    expect(
      planFeeProposalTitle(
        tracked({ currentTitle: 'Board minutes', customProperty: FIRST, customXml: 'L'.repeat(300) }),
        NEXT,
      ).title,
    ).toBeNull();
  });

  it('does not write an empty suggestion over anything', () => {
    expect(planFeeProposalTitle(tracked({ currentTitle: '' }), '   ')).toEqual({
      title: null,
      customProperty: null,
      customXml: undefined,
    });
  });

  it('round-trips an ampersand through the custom XML payload', () => {
    const suggested = `${'Fish & Chips '.repeat(40)}End`;
    expect(suggested.length).toBeGreaterThan(CUSTOM_PROPERTY_MAX);
    const plan = planFeeProposalTitle(tracked(), suggested);
    expect(plan.customXml).toBe(suggested);
    const xml = feeProposalTitleXml(plan.customXml ?? '');
    expect(xml).toContain('Fish &amp; Chips');
    expect(xml).not.toContain('Fish & Chips');
    expect(parseFeeProposalTitleXml(xml)).toBe(suggested);
  });
});

describe('syncFeeProposalDocumentTitle', () => {
  it('sets, then updates, then leaves a title the user changed by hand', async () => {
    const store = memoryStore(tracked());

    await syncFeeProposalDocumentTitle(store, FIRST);
    expect(store.current).toEqual({ currentTitle: FIRST, customProperty: FIRST, customXml: null });

    await syncFeeProposalDocumentTitle(store, NEXT);
    expect(store.current.currentTitle).toBe(NEXT);
    expect(store.current.customProperty).toBe(NEXT);

    store.current.currentTitle = 'My own title';
    const writes = store.writes.length;
    const kept = await syncFeeProposalDocumentTitle(store, '0804 Other Farm Fire Dynamics Group Fee Proposal 14-11-26');
    expect(kept).toEqual({ title: null, customProperty: null, customXml: undefined });
    expect(store.writes).toHaveLength(writes);
    expect(store.current.currentTitle).toBe('My own title');
    expect(store.current.customProperty).toBe(NEXT);
  });
});

type WordState = {
  title: string;
  custom: Map<string, string>;
  xml: Map<string, string>;
};

function mockWord(
  initial?: { title?: string; custom?: Record<string, string>; xml?: Record<string, string> },
  options?: { wordApi14?: boolean },
): WordState {
  const state: WordState = {
    title: initial?.title ?? '',
    custom: new Map(Object.entries(initial?.custom ?? {})),
    xml: new Map(Object.entries(initial?.xml ?? {})),
  };
  const wordApi14 = options?.wordApi14 !== false;
  (globalThis as unknown as { Office: unknown }).Office = {
    context: {
      requirements: {
        isSetSupported: (name: string, version: string) =>
          name === 'WordApi' && (version === '1.3' || (wordApi14 && version === '1.4')),
      },
      document: { url: '' },
    },
  };
  (globalThis as unknown as { Word: unknown }).Word = {
    run: async (fn: (ctx: unknown) => Promise<void>) => {
      const properties: Record<string, unknown> = {};
      Object.defineProperty(properties, 'title', {
        get: () => state.title,
        set: (value: string) => {
          state.title = value;
        },
        configurable: true,
      });
      properties.load = () => undefined;
      const customItems = () =>
        [...state.custom.entries()].map(([key]) => {
          const item: { key: string; value: string } = { key, value: state.custom.get(key) ?? '' };
          Object.defineProperty(item, 'value', {
            get: () => state.custom.get(key) ?? '',
            set: (next: string) => {
              if (String(next).length > CUSTOM_PROPERTY_MAX) {
                throw new Error('The value of a custom document property is limited to 255 characters.');
              }
              state.custom.set(key, String(next));
            },
          });
          return item;
        });
      const custom = {
        items: [] as { key: string; value: string }[],
        load: () => {
          custom.items = customItems();
        },
        add: (key: string, value: string) => {
          if (String(value).length > CUSTOM_PROPERTY_MAX) {
            throw new Error('The value of a custom document property is limited to 255 characters.');
          }
          state.custom.set(key, String(value));
          custom.items = customItems();
        },
      };
      properties.customProperties = custom;
      const ctx = {
        document: {
          properties,
          customXmlParts: {
            getByNamespace: (ns: string) => {
              const collection: {
                items: { getXml: () => { value: string }; delete: () => void }[];
                load: () => void;
              } = {
                items: [],
                load: () => {
                  const xml = state.xml.get(ns);
                  collection.items = xml
                    ? [
                        {
                          getXml: () => ({ value: xml }),
                          delete: () => {
                            state.xml.delete(ns);
                          },
                        },
                      ]
                    : [];
                },
              };
              return collection;
            },
            add: (xml: string) => {
              const ns = /xmlns:fdg="([^"]+)"/.exec(xml)?.[1];
              if (!ns) throw new Error('custom XML part is missing its namespace');
              state.xml.set(ns, xml);
            },
          },
        },
        sync: async () => undefined,
      };
      await fn(ctx);
    },
  };
  return state;
}

describe('applySuggestedDocumentTitle', () => {
  const g = globalThis as unknown as { Word?: unknown; Office?: unknown };

  afterEach(() => {
    delete g.Word;
    delete g.Office;
  });

  it('does nothing outside Word', async () => {
    await expect(applySuggestedDocumentTitle(FIRST)).resolves.toBe('unsupported');
  });

  it('does nothing when WordApi 1.3 is unavailable', async () => {
    g.Word = { run: async () => { throw new Error('Word.run should not be called'); } };
    g.Office = { context: { requirements: { isSetSupported: () => false }, document: { url: '' } } };
    await expect(applySuggestedDocumentTitle(FIRST)).resolves.toBe('unsupported');
  });

  it('sets a short Title on WordApi 1.3 without custom XML parts', async () => {
    const word = mockWord(undefined, { wordApi14: false });
    const office = (globalThis as unknown as { Word: { run: (fn: (ctx: unknown) => Promise<void>) => Promise<void> } }).Word;
    const run = office.run;
    office.run = async (fn) => {
      await run(async (ctx) => {
        const document = ctx as { document: { customXmlParts: unknown } };
        Object.defineProperty(document.document, 'customXmlParts', {
          get() {
            throw new Error('customXmlParts requires WordApi 1.4');
          },
        });
        await fn(ctx);
      });
    };
    await expect(applySuggestedDocumentTitle(FIRST)).resolves.toBe('updated');
    expect(word.title).toBe(FIRST);
    expect(word.custom.get(FEE_PROPOSAL_TITLE_PROPERTY)).toBe(FIRST);
    expect(word.xml.size).toBe(0);
  });

  it('writes the core Title and the tracking custom property', async () => {
    const word = mockWord();
    await expect(applySuggestedDocumentTitle(FIRST)).resolves.toBe('updated');
    expect(word.title).toBe(FIRST);
    expect(word.custom.get(FEE_PROPOSAL_TITLE_PROPERTY)).toBe(FIRST);
    await expect(applySuggestedDocumentTitle(FIRST)).resolves.toBe('kept');
    expect(word.title).toBe(FIRST);
  });

  it('does not clobber a Title the user set', async () => {
    const word = mockWord({ title: 'Board minutes' });
    await expect(applySuggestedDocumentTitle(FIRST)).resolves.toBe('kept');
    expect(word.title).toBe('Board minutes');
    expect(word.custom.has(FEE_PROPOSAL_TITLE_PROPERTY)).toBe(false);
  });

  it('updates a Title the add-in previously wrote', async () => {
    const word = mockWord({ title: FIRST, custom: { [FEE_PROPOSAL_TITLE_PROPERTY]: FIRST } });
    await expect(applySuggestedDocumentTitle(NEXT)).resolves.toBe('updated');
    expect(word.title).toBe(NEXT);
    expect(word.custom.get(FEE_PROPOSAL_TITLE_PROPERTY)).toBe(NEXT);
  });

  it('keeps a long title in custom XML and will not overwrite a later manual Title', async () => {
    const longTitle = buildFeeProposalFilename({
      numberFormatted: '0602',
      projectName: `${'Fish & Chips '.repeat(40)}End`,
      now: new Date('2026-11-12T12:00:00.000Z'),
    });
    expect(longTitle.length).toBeGreaterThan(CUSTOM_PROPERTY_MAX);
    const word = mockWord();
    await expect(applySuggestedDocumentTitle(longTitle)).resolves.toBe('updated');
    expect(word.title).toBe(longTitle);
    expect(word.custom.get(FEE_PROPOSAL_TITLE_PROPERTY)).toBe(LONG_TITLE_SENTINEL);
    const storedXml = [...word.xml.values()][0] ?? '';
    expect(storedXml).toContain('&amp;');
    expect(parseFeeProposalTitleXml(storedXml)).toBe(longTitle);

    word.title = 'Board minutes';
    await expect(applySuggestedDocumentTitle(NEXT)).resolves.toBe('kept');
    expect(word.title).toBe('Board minutes');
    expect(word.custom.get(FEE_PROPOSAL_TITLE_PROPERTY)).toBe(LONG_TITLE_SENTINEL);
    expect(parseFeeProposalTitleXml([...word.xml.values()][0] ?? null)).toBe(longTitle);
  });

  it('replaces a long add-in Title with a short one and drops the XML copy', async () => {
    const longTitle = 'L'.repeat(CUSTOM_PROPERTY_MAX + 20);
    const word = mockWord();
    await applySuggestedDocumentTitle(longTitle);
    await expect(applySuggestedDocumentTitle(FIRST)).resolves.toBe('updated');
    expect(word.title).toBe(FIRST);
    expect(word.custom.get(FEE_PROPOSAL_TITLE_PROPERTY)).toBe(FIRST);
    expect(word.xml.size).toBe(0);

    await expect(applySuggestedDocumentTitle(NEXT)).resolves.toBe('updated');
    expect(word.title).toBe(NEXT);
  });
});
