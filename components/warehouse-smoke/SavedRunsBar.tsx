'use client';

import { useEffect, useState } from 'react';

import { deleteRun, listSavedRuns, saveRun } from '../../lib/smoke-layer-api';
import { loadDocument, type SmokeLayerDocument } from '../../lib/smoke-layer-project';
import type { SavedRun } from '../../lib/smoke-layer-types';

interface SavedRunsBarProps {
  /** The whole form, saved as typed — a part-filled document can be saved and finished later. */
  document: SmokeLayerDocument;
  onLoad: (document: SmokeLayerDocument) => void;
}

const controlClass =
  'px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent';

export default function SavedRunsBar({ document, onLoad }: SavedRunsBarProps) {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    listSavedRuns()
      .then(setRuns)
      .catch(() => setUnavailable(true));
  }, []);

  async function handleSave() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveRun(name.trim(), document.project.projectName, document);
      setRuns((current) => [saved, ...current.filter((r) => r.id !== saved.id)]);
      setSelectedId(saved.id);
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  function handleLoad() {
    const run = runs.find((r) => r.id === selectedId);
    if (!run) return;
    setError(null);
    try {
      onLoad(loadDocument(run.inputs));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }

  async function handleDelete() {
    const run = runs.find((r) => r.id === selectedId);
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      await deleteRun(run.id);
      setRuns((current) => current.filter((r) => r.id !== run.id));
      setSelectedId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  }

  if (unavailable) return null;

  return (
    <div className="border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="saved-run" className="block text-sm font-medium text-gray-700 mb-1">
            Saved runs
          </label>
          <select
            id="saved-run"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={`${controlClass} w-full`}
          >
            <option value="">{runs.length ? 'Select a saved run' : 'Nothing saved yet'}</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.name}
                {run.project_name ? ` — ${run.project_name}` : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleLoad}
          disabled={!selectedId || busy}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Load
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!selectedId || busy}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Delete
        </button>

        <div className="flex-1 min-w-[200px]">
          <label htmlFor="save-as" className="block text-sm font-medium text-gray-700 mb-1">
            Save current inputs as
          </label>
          <input
            id="save-as"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Shed Zone — three units"
            className={`${controlClass} w-full`}
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || busy}
          className="px-4 py-2 rounded-lg bg-black hover:bg-gray-800 text-sm text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
