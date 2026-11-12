import {
  createNamedFeeProposalDocument,
  getDocumentBase64,
  uint8ArrayToBase64,
  type NamedProposalResult,
} from '../../lib/word-ops';

describe('uint8ArrayToBase64 helper', () => {
  it('converts byte array to base64 correctly', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(uint8ArrayToBase64(bytes)).toBe('SGVsbG8=');
  });

  it('handles empty byte array', () => {
    expect(uint8ArrayToBase64(new Uint8Array(0))).toBe('');
  });
});

describe('getDocumentBase64', () => {
  const g = globalThis as unknown as { Office?: any };

  afterEach(() => {
    delete g.Office;
  });

  it('throws when Office is not available', async () => {
    await expect(getDocumentBase64()).rejects.toThrow(/Office/);
  });

  it('reads compressed document slices and returns base64', async () => {
    let closed = false;
    const sliceData = [
      new Uint8Array([72, 101]), // "He"
      new Uint8Array([108, 108, 111]), // "llo"
    ];

    g.Office = {
      FileType: { Compressed: 1 },
      AsyncResultStatus: { Succeeded: 0, Failed: 1 },
      context: {
        document: {
          getFileAsync: (type: number, options: any, cb: (res: any) => void) => {
            expect(type).toBe(1);
            cb({
              status: 0,
              value: {
                sliceCount: 2,
                getSliceAsync: (index: number, sliceCb: (sRes: any) => void) => {
                  sliceCb({
                    status: 0,
                    value: { data: sliceData[index] },
                  });
                },
                closeAsync: () => {
                  closed = true;
                },
              },
            });
          },
        },
      },
    };

    const b64 = await getDocumentBase64();
    expect(b64).toBe('SGVsbG8=');
    expect(closed).toBe(true);
  });

  it('handles slice data as standard Array<number>', async () => {
    let closed = false;
    g.Office = {
      FileType: { Compressed: 1 },
      AsyncResultStatus: { Succeeded: 0, Failed: 1 },
      context: {
        document: {
          getFileAsync: (type: number, options: any, cb: (res: any) => void) => {
            cb({
              status: 0,
              value: {
                sliceCount: 1,
                getSliceAsync: (index: number, sliceCb: (sRes: any) => void) => {
                  sliceCb({
                    status: 0,
                    value: { data: [72, 101, 108, 108, 111] },
                  });
                },
                closeAsync: () => {
                  closed = true;
                },
              },
            });
          },
        },
      },
    };

    const b64 = await getDocumentBase64();
    expect(b64).toBe('SGVsbG8=');
    expect(closed).toBe(true);
  });

  it('rejects and closes file when getSliceAsync fails', async () => {
    let closed = false;
    g.Office = {
      FileType: { Compressed: 1 },
      AsyncResultStatus: { Succeeded: 0, Failed: 1 },
      context: {
        document: {
          getFileAsync: (type: number, options: any, cb: (res: any) => void) => {
            cb({
              status: 0,
              value: {
                sliceCount: 1,
                getSliceAsync: (index: number, sliceCb: (sRes: any) => void) => {
                  sliceCb({
                    status: 1,
                    error: { message: 'Slice read error' },
                  });
                },
                closeAsync: () => {
                  closed = true;
                },
              },
            });
          },
        },
      },
    };

    await expect(getDocumentBase64()).rejects.toThrow('Slice read error');
    expect(closed).toBe(true);
  });
});

describe('createNamedFeeProposalDocument', () => {
  const g = globalThis as unknown as { Word?: any; Office?: any };
  const TEST_FILENAME = '0602 Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26';

  function setupOffice(opts: {
    url?: string;
    hiddenDoc15?: boolean;
    wordApi15?: boolean;
    desktop14?: boolean;
  } = {}) {
    g.Office = {
      FileType: { Compressed: 1 },
      AsyncResultStatus: { Succeeded: 0, Failed: 1 },
      context: {
        document: {
          url: opts.url ?? 'https://contoso.sharepoint.com/sites/fd/Document.docx',
          getFileAsync: (type: number, options: any, cb: (res: any) => void) => {
            cb({
              status: 0,
              value: {
                sliceCount: 1,
                getSliceAsync: (index: number, sliceCb: (sRes: any) => void) => {
                  sliceCb({
                    status: 0,
                    value: { data: [84, 69, 83, 84] }, // "TEST"
                  });
                },
                closeAsync: () => {},
              },
            });
          },
        },
        requirements: {
          isSetSupported: (name: string, ver: string) => {
            if (name === 'WordApiHiddenDocument' && ver === '1.5') return !!opts.hiddenDoc15;
            if (name === 'WordApi' && ver === '1.5') return !!opts.wordApi15;
            if (name === 'WordApiDesktop' && ver === '1.4') return !!opts.desktop14;
            return false;
          },
        },
      },
    };
  }

  afterEach(() => {
    delete g.Word;
    delete g.Office;
  });

  it('rejects when Office or Word is not available', async () => {
    await expect(createNamedFeeProposalDocument(TEST_FILENAME)).rejects.toThrow(/not available/);
  });

  describe('Path A: WordApiHiddenDocument 1.5 supported', () => {
    it('creates document with base64, saves with filename, opens, and syncs', async () => {
      setupOffice({ hiddenDoc15: true, desktop14: true });

      const calls: {
        createdWithBase64?: string;
        saveBehavior?: string;
        saveName?: string;
        opened?: boolean;
        syncCount: number;
        loadedFullName?: boolean;
      } = { syncCount: 0 };

      const mockCreatedDoc = {
        save: (behavior: string, name: string) => {
          calls.saveBehavior = behavior;
          calls.saveName = name;
        },
        open: () => {
          calls.opened = true;
        },
        fullName: 'C:\\Users\\IanShaw\\OneDrive\\0602 Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26.docx',
        load: (prop: string) => {
          if (prop === 'fullName') calls.loadedFullName = true;
        },
      };

      g.Word = {
        SaveBehavior: { save: 'Save', prompt: 'Prompt' },
        run: async (fn: (ctx: any) => Promise<void>) => {
          const ctx = {
            application: {
              createDocument: (b64: string) => {
                calls.createdWithBase64 = b64;
                return mockCreatedDoc;
              },
            },
            sync: async () => {
              calls.syncCount++;
            },
          };
          await fn(ctx);
        },
      };

      const result = await createNamedFeeProposalDocument(TEST_FILENAME);

      expect(calls.createdWithBase64).toBe('VEVTVA=='); // base64 of "TEST"
      expect(calls.saveBehavior).toBe('Save');
      expect(calls.saveName).toBe(TEST_FILENAME);
      expect(calls.opened).toBe(true);
      expect(calls.syncCount).toBeGreaterThanOrEqual(1);
      expect(result).toEqual({
        path: 'A',
        saved: true,
        filename: TEST_FILENAME,
        savedLocation: 'C:\\Users\\IanShaw\\OneDrive\\0602 Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26.docx',
      });
    });

    it('uses provided docBase64 directly on Path A without reading active document', async () => {
      const calls = { createdWithBase64: '', saveBehavior: '', saveName: '', opened: false };
      setupOffice({ hiddenDoc15: true, desktop14: true });

      const mockCreatedDoc = {
        fullName: 'C:\\Users\\IanShaw\\Documents\\0602.docx',
        load: jest.fn(),
        save: jest.fn((behavior: string, name: string) => {
          calls.saveBehavior = behavior;
          calls.saveName = name;
        }),
        open: jest.fn(() => {
          calls.opened = true;
        }),
      };

      g.Word = {
        SaveBehavior: { save: 'Save' },
        run: async (fn: (ctx: any) => Promise<void>) => {
          const ctx = {
            application: {
              createDocument: (b64: string) => {
                calls.createdWithBase64 = b64;
                return mockCreatedDoc;
              },
            },
            sync: async () => {},
          };
          await fn(ctx);
        },
      };

      const result = await createNamedFeeProposalDocument(TEST_FILENAME, 'EXPLICIT_GENERATED_BASE64');

      expect(calls.createdWithBase64).toBe('EXPLICIT_GENERATED_BASE64');
      expect(calls.saveName).toBe(TEST_FILENAME);
      expect(result.saved).toBe(true);
    });

    it('handles Path A when WordApiDesktop 1.4 is not supported', async () => {
      setupOffice({ hiddenDoc15: true, desktop14: false });

      const mockCreatedDoc = {
        save: jest.fn(),
        open: jest.fn(),
      };

      g.Word = {
        SaveBehavior: { save: 'Save' },
        run: async (fn: (ctx: any) => Promise<void>) => {
          const ctx = {
            application: {
              createDocument: () => mockCreatedDoc,
            },
            sync: async () => {},
          };
          await fn(ctx);
        },
      };

      const result = await createNamedFeeProposalDocument(TEST_FILENAME);
      expect(result).toEqual({
        path: 'A',
        saved: true,
        filename: TEST_FILENAME,
        savedLocation: null,
      });
    });
  });

  describe('Path B: WordApiHiddenDocument 1.5 not supported, document unsaved, WordApi 1.5 supported', () => {
    it('saves current document in place without creating new document', async () => {
      setupOffice({
        url: '', // Unsaved document
        hiddenDoc15: false,
        wordApi15: true,
        desktop14: true,
      });

      const calls: {
        docSaved?: boolean;
        saveBehavior?: string;
        saveName?: string;
        createDocCalled: boolean;
        syncCount: number;
        loadedFullName?: boolean;
      } = { createDocCalled: false, syncCount: 0 };

      const mockCurrentDoc = {
        save: (behavior: string, name: string) => {
          calls.docSaved = true;
          calls.saveBehavior = behavior;
          calls.saveName = name;
        },
        fullName: 'C:\\Users\\IanShaw\\Documents\\0602 Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26.docx',
        load: (prop: string) => {
          if (prop === 'fullName') calls.loadedFullName = true;
        },
      };

      g.Word = {
        SaveBehavior: { save: 'Save' },
        run: async (fn: (ctx: any) => Promise<void>) => {
          const ctx = {
            document: mockCurrentDoc,
            application: {
              createDocument: () => {
                calls.createDocCalled = true;
                return {};
              },
            },
            sync: async () => {
              calls.syncCount++;
            },
          };
          await fn(ctx);
        },
      };

      const result = await createNamedFeeProposalDocument(TEST_FILENAME);

      expect(calls.createDocCalled).toBe(false);
      expect(calls.docSaved).toBe(true);
      expect(calls.saveBehavior).toBe('Save');
      expect(calls.saveName).toBe(TEST_FILENAME);
      expect(result).toEqual({
        path: 'B',
        saved: true,
        filename: TEST_FILENAME,
        savedLocation: 'C:\\Users\\IanShaw\\Documents\\0602 Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26.docx',
      });
    });
  });

  describe('Path C: Fallback when document is already saved and WordApiHiddenDocument 1.5 is unsupported', () => {
    it('creates document and opens without saving, returning saved: false', async () => {
      setupOffice({
        url: 'https://contoso.sharepoint.com/sites/fd/Document.docx', // Already saved
        hiddenDoc15: false,
        wordApi15: true, // WordApi 1.5 is supported, but document is already saved so cannot Path B
      });

      const calls: {
        createdWithBase64?: string;
        opened?: boolean;
        saveCalled?: boolean;
      } = {};

      const mockCreatedDoc = {
        open: () => {
          calls.opened = true;
        },
        save: () => {
          calls.saveCalled = true;
        },
      };

      g.Word = {
        SaveBehavior: { save: 'Save' },
        run: async (fn: (ctx: any) => Promise<void>) => {
          const ctx = {
            application: {
              createDocument: (b64: string) => {
                calls.createdWithBase64 = b64;
                return mockCreatedDoc;
              },
            },
            sync: async () => {},
          };
          await fn(ctx);
        },
      };

      const result = await createNamedFeeProposalDocument(TEST_FILENAME);

      expect(calls.createdWithBase64).toBe('VEVTVA==');
      expect(calls.opened).toBe(true);
      expect(calls.saveCalled).toBeUndefined();
      expect(result).toEqual({
        path: 'C',
        saved: false,
        filename: TEST_FILENAME,
        savedLocation: null,
      });
    });
  });

  describe('Path C: Fallback when neither WordApiHiddenDocument 1.5 nor WordApi 1.5 is supported', () => {
    it('creates document and opens without saving', async () => {
      setupOffice({
        url: '', // Unsaved, but WordApi 1.5 not supported
        hiddenDoc15: false,
        wordApi15: false,
      });

      const mockCreatedDoc = {
        open: jest.fn(),
        save: jest.fn(),
      };

      g.Word = {
        run: async (fn: (ctx: any) => Promise<void>) => {
          const ctx = {
            application: {
              createDocument: () => mockCreatedDoc,
            },
            sync: async () => {},
          };
          await fn(ctx);
        },
      };

      const result = await createNamedFeeProposalDocument(TEST_FILENAME);

      expect(mockCreatedDoc.open).toHaveBeenCalled();
      expect(mockCreatedDoc.save).not.toHaveBeenCalled();
      expect(result).toEqual({
        path: 'C',
        saved: false,
        filename: TEST_FILENAME,
        savedLocation: null,
      });
    });
  });
});
