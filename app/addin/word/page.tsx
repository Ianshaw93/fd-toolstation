'use client';

import Script from 'next/script';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchSections,
  fetchSources,
  fetchTemplate,
  matchEntries,
  renderReferences,
  renderSection,
  scanCitations,
  type Proposal,
  type Section,
  type Source,
} from '../../../lib/word-addin-api';
import FeeProposalPane from '../../../components/addin/FeeProposalPane';
import {
  applyCitations,
  insertSectionAtCursor,
  isSetSupported,
  listSectionTags,
  newDocumentFromBase64,
  officeReady,
  readBodyParagraphs,
  readExistingReferences,
  regenerateSection,
  SECTION_TAG_PREFIX,
  updateAllFields,
  type ApplyStrategy,
  type ParagraphText,
} from '../../../lib/word-ops';

// The Word add-in task pane. Three jobs: open a fresh document from a team template,
// insert regenerable sections at the cursor, and find + write citations natively.
// In a plain browser (no Office host) it renders in preview mode with the Word actions
// disabled, which is enough to check the backend wiring.

const OFFICE_JS = 'https://appsforoffice.microsoft.com/lib/1/hosted/office.js';

// Inside an Office host, office.js sets window.history.replaceState/pushState to null the
// moment it loads, and the Next router calls them ("replaceState is not a function").
// This module evaluates before the afterInteractive script runs, so the originals are
// captured here and put back as soon as office.js has loaded.
const nativeHistory =
  typeof window !== 'undefined'
    ? { replaceState: window.history.replaceState, pushState: window.history.pushState }
    : null;

function restoreHistory() {
  if (!nativeHistory) return;
  if (typeof window.history.replaceState !== 'function') window.history.replaceState = nativeHistory.replaceState;
  if (typeof window.history.pushState !== 'function') window.history.pushState = nativeHistory.pushState;
}

const TEMPLATES = [
  { name: 'report', label: 'Warehouse report skin' },
  { name: 'appendix', label: 'Appendix skin' },
  { name: 'fee-letter', label: 'Fee proposal letter' },
];

type Host = 'loading' | 'word' | 'preview';

export default function WordAddinPage() {
  const [host, setHost] = useState<Host>('loading');
  const [tab, setTab] = useState<'fee' | 'tools'>('fee');
  // The shareable add-in is the fee proposal only. The sections/citations experiments stay
  // reachable in development by opening the pane URL with ?dev=1 (localhost manifest).
  const [devTools, setDevTools] = useState(false);
  useEffect(() => {
    setDevTools(new URLSearchParams(window.location.search).get('dev') === '1');
  }, []);
  const [sections, setSections] = useState<Section[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [presentTags, setPresentTags] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [paragraphs, setParagraphs] = useState<ParagraphText[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [strategy, setStrategy] = useState<ApplyStrategy>('rebuild');
  const [existingSummary, setExistingSummary] = useState<string>('');

  const say = useCallback((line: string) => setLog((prev) => [line, ...prev].slice(0, 12)), []);

  const boot = useCallback(async () => {
    restoreHistory();
    const inWord = await officeReady();
    restoreHistory();
    setHost(inWord ? 'word' : 'preview');
    if (inWord) {
      say(`Word host. WordApi 1.5: ${isSetSupported('WordApi', '1.5') ? 'yes' : 'no (fields unavailable)'}`);
      refreshTags();
    } else {
      say('No Office host: preview mode, Word actions disabled.');
    }
  }, [say]);

  useEffect(() => {
    fetchSections().then(setSections).catch((e) => say(`Backend: ${e.message}`));
    fetchSources().then(setSources).catch(() => undefined);
    // If office.js never calls back (CDN blocked, plain browser), settle into preview mode.
    const t = setTimeout(() => setHost((h) => (h === 'loading' ? 'preview' : h)), 4000);
    return () => clearTimeout(t);
  }, [say]);

  const refreshTags = async () => {
    try {
      setPresentTags(await listSectionTags());
    } catch {
      /* not in Word */
    }
  };

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    try {
      const msg = await fn();
      say(msg || `${label}: done`);
    } catch (e) {
      // OfficeExtension.Error carries the failing statement in debugInfo; surface it.
      const info = (e as { debugInfo?: { errorLocation?: string; statement?: string; message?: string } }).debugInfo;
      const where = info ? ` [${info.errorLocation ?? ''} ${info.statement ?? ''}]`.trimEnd() : '';
      say(`${label}: ${e instanceof Error ? e.message : String(e)}${where}`);
      // warn, not error: the dev overlay turns console.error into a modal for what is
      // already reported in the pane's log.
      console.warn(label, e, info);
    } finally {
      setBusy(null);
    }
  };

  const inWord = host === 'word';
  const entryText = useMemo(() => {
    const map = new Map(sources.map((s) => [s.id, s.entry]));
    return (id: string) => map.get(id) ?? id;
  }, [sources]);

  const acceptedProposals = proposals.filter((_, i) => accepted.has(i));
  const grouped = useMemo(() => {
    const byPara = new Map<number, { i: number; p: Proposal }[]>();
    proposals.forEach((p, i) => byPara.set(p.paragraph, [...(byPara.get(p.paragraph) || []), { i, p }]));
    return [...byPara.entries()].sort((a, b) => a[0] - b[0]);
  }, [proposals]);
  const paragraphText = (index: number) => paragraphs.find((p) => p.index === index)?.text ?? '';

  const doScan = (llm: boolean) =>
    run(llm ? 'AI scan' : 'Scan', async () => {
      const paras = await readBodyParagraphs();
      setParagraphs(paras);
      const result = await scanCitations(paras, llm);
      setProposals(result.proposals);
      setAccepted(new Set(result.proposals.map((_, i) => i)));
      const existing = await readExistingReferences();
      setExistingSummary(
        existing.headingIndex === null
          ? 'No References section yet.'
          : `${existing.entries.length} existing entries (${existing.native ? 'native list' : 'typed'}).`,
      );
      const s = result.stats;
      return `${result.proposals.length} proposals from ${s.paragraphs} paragraphs${llm ? ` (${s.model}, ${s.llm_seconds}s)` : ''}`;
    });

  const doApply = () =>
    run('Apply', async () => {
      const r = await applyCitations(acceptedProposals, paragraphs, strategy, renderReferences, matchEntries, entryText);
      setProposals([]);
      await refreshTags();
      return `Inserted ${r.inserted} citation fields (${r.anchorsMissed} at paragraph end), list of ${r.order.length}${
        r.adopted ? `, ${r.adopted} existing entries kept` : ''
      }.`;
    });

  return (
    <div className="min-h-screen bg-white text-gray-900 text-sm">
      <Script src={OFFICE_JS} strategy="afterInteractive" onLoad={boot} onError={() => setHost('preview')} />
      <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-base">{devTools ? 'FD Word Tools' : 'FD Fee Proposal'}</h1>
          <p className="text-xs text-gray-500">
            {host === 'loading' ? 'Connecting to Word…' : inWord ? 'Connected to Word' : 'Preview mode (not inside Word)'}
          </p>
        </div>
        {busy && <span className="text-xs text-blue-600 animate-pulse">{busy}…</span>}
      </header>

      {devTools && (
      <nav className="px-4 pt-2 flex gap-1 border-b border-gray-200">
        {(['fee', 'tools'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-t-lg border border-b-0 ${
              tab === t ? 'bg-white border-gray-300 font-medium' : 'bg-gray-50 border-transparent text-gray-500'
            }`}
          >
            {t === 'fee' ? 'Fee proposal' : 'Sections & citations'}
          </button>
        ))}
      </nav>
      )}

      {tab === 'fee' && (
        <main className="px-4 py-3">
          <FeeProposalPane inWord={inWord} busy={busy} run={run} devTools={devTools} />
          <section className="mt-4">
            <h2 className="font-medium mb-1">Log</h2>
            <ul className="text-xs text-gray-600 space-y-0.5 font-mono">
              {log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </section>
        </main>
      )}

      {tab === 'tools' && (
      <main className="px-4 py-3 space-y-6">
        <section>
          <h2 className="font-medium mb-2">New document</h2>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                disabled={!inWord || !!busy}
                onClick={() => run(`New ${t.label}`, async () => newDocumentFromBase64(await fetchTemplate(t.name)))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-medium mb-2">Insert section at cursor</h2>
          <ul className="space-y-2">
            {sections.map((s) => {
              const present = presentTags.includes(SECTION_TAG_PREFIX + s.id);
              return (
                <li key={s.id} className="border border-gray-200 rounded-lg p-2">
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-gray-500 mb-2">{s.description}</div>
                  <div className="flex gap-2">
                    <button
                      disabled={!inWord || !!busy}
                      onClick={() =>
                        run(`Insert ${s.label}`, async () => {
                          await insertSectionAtCursor(await renderSection(s.id), s.id, s.label);
                          await refreshTags();
                        })
                      }
                      className="px-3 py-1 rounded-lg bg-gray-900 text-white disabled:opacity-40"
                    >
                      Insert
                    </button>
                    {present && (
                      <button
                        disabled={!inWord || !!busy}
                        onClick={() =>
                          run(`Regenerate ${s.label}`, async () => {
                            const ok = await regenerateSection(await renderSection(s.id), s.id);
                            return ok ? `Regenerated ${s.label}` : `No ${s.label} section found to regenerate`;
                          })
                        }
                        className="px-3 py-1 rounded-lg border border-gray-300 disabled:opacity-40"
                      >
                        Regenerate
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {sections.length === 0 && <li className="text-xs text-gray-500">No sections loaded (backend down?).</li>}
          </ul>
        </section>

        <section>
          <h2 className="font-medium mb-2">Citations</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              disabled={!inWord || !!busy}
              onClick={() => doScan(false)}
              className="px-3 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-40"
            >
              Scan (fast)
            </button>
            <button
              disabled={!inWord || !!busy}
              onClick={() => doScan(true)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
              title="Runs the local model through Ollama; a few seconds per paragraph"
            >
              Scan with local AI
            </button>
            <button
              disabled={!inWord || !!busy}
              onClick={() => run('Update fields', async () => `Updated ${await updateAllFields()} fields`)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
            >
              Update fields
            </button>
          </div>
          {existingSummary && <p className="text-xs text-gray-500 mb-2">{existingSummary}</p>}

          {proposals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1">
                  <input type="radio" checked={strategy === 'rebuild'} onChange={() => setStrategy('rebuild')} />
                  Rebuild list (first-citation order)
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={strategy === 'adopt'} onChange={() => setStrategy('adopt')} />
                  Keep existing numbering
                </label>
              </div>
              <ul className="space-y-2 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {grouped.map(([paraIndex, items]) => (
                  <li key={paraIndex}>
                    <div className="text-xs text-gray-500 truncate" title={paragraphText(paraIndex)}>
                      ¶{paraIndex}: {paragraphText(paraIndex).slice(0, 90)}
                    </div>
                    {items.map(({ i, p }) => (
                      <label key={i} className="flex items-start gap-2 py-0.5">
                        <input
                          type="checkbox"
                          checked={accepted.has(i)}
                          onChange={(e) =>
                            setAccepted((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(i);
                              else next.delete(i);
                              return next;
                            })
                          }
                        />
                        <span>
                          <span className="font-medium">{p.label.split(' (')[0]}</span>
                          <span className="text-xs text-gray-500">
                            {' '}
                            · {p.tier} · {p.confidence}
                            {p.anchor ? ` · after "${p.anchor.slice(0, 40)}"` : ' · at paragraph end'}
                          </span>
                        </span>
                      </label>
                    ))}
                  </li>
                ))}
              </ul>
              <button
                disabled={!inWord || !!busy || acceptedProposals.length === 0}
                onClick={doApply}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40"
              >
                Apply {acceptedProposals.length} citations
              </button>
            </div>
          )}
        </section>

        <section>
          <h2 className="font-medium mb-1">Log</h2>
          <ul className="text-xs text-gray-600 space-y-0.5 font-mono">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      </main>
      )}
    </div>
  );
}
