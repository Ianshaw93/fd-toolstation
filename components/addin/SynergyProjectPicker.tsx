'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  searchSynergyProjects,
  logSynergyProjectOpen,
  type SynergyProjectHit,
  type SynergyCacheStatus,
} from '../../lib/synergy-api';

interface Props {
  selectedId?: number;
  selectedOrgId?: number;
  selectedLabel?: string;
  onSelect: (hit: SynergyProjectHit) => void;
  onUnlink: () => void;
}

export default function SynergyProjectPicker({
  selectedId,
  selectedOrgId,
  selectedLabel,
  onSelect,
  onUnlink,
}: Props) {
  const [query, setQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [results, setResults] = useState<SynergyProjectHit[]>([]);
  const [cacheStatus, setCacheStatus] = useState<SynergyCacheStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(async (q: string, inactive: boolean) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await searchSynergyProjects(q, inactive);
      setResults(res.items);
      setCacheStatus(res.cache);
    } catch (err: any) {
      setError(err.message || 'Failed to search Synergy directory');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query, includeInactive);
    }, 250);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, includeInactive, performSearch]);

  const handleSelect = (hit: SynergyProjectHit, rank: number) => {
    onSelect(hit);
    logSynergyProjectOpen(hit.organisation_id, hit.synergy_project_id, rank);
    setIsSearching(false);
    setQuery('');
    setResults([]);
  };

  const isLinked = selectedId !== undefined && selectedId !== null;

  if (isLinked) {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-sky-800">
          <span className="font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            Linked Synergy Project
          </span>
          <button
            type="button"
            onClick={onUnlink}
            className="text-xs text-sky-700 hover:text-sky-900 font-medium underline"
          >
            Change / Unlink
          </button>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-900 leading-snug">
            {selectedLabel || 'Selected Project'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <label htmlFor="synergy-search-input" className="block text-xs font-semibold text-gray-700">
          Synergy Project <span className="font-normal text-gray-500">(Optional)</span>
        </label>
        {cacheStatus?.stale && (
          <span className="text-2xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
            Cache stale
          </span>
        )}
      </div>

      <div className="relative">
        <input
          id="synergy-search-input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsSearching(true);
          }}
          onFocus={() => setIsSearching(true)}
          placeholder="Search by job # or name (e.g. 0657)…"
          className="w-full px-3 py-2 text-sm rounded-md bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
          />
          <span>Include inactive / archived</span>
        </label>
      </div>

      {/* Results Dropdown */}
      {isSearching && query.trim() !== '' && (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm divide-y divide-gray-100 max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-xs text-gray-500 text-center">Searching Synergy directory…</div>
          ) : error ? (
            <div className="p-3 text-xs text-rose-600">{error}</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-gray-500">
              No matching Synergy projects found. You can enter details manually below.
            </div>
          ) : (
            results.map((hit, idx) => (
              <button
                key={hit.synergy_project_id}
                type="button"
                onClick={() => handleSelect(hit, idx)}
                className="w-full text-left p-2.5 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-900">{hit.label}</span>
                  {hit.status && (
                    <span
                      className={`text-2xs px-1.5 py-0.5 rounded font-medium ${
                        hit.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {hit.status}
                    </span>
                  )}
                </div>
                {hit.location && (
                  <div className="text-2xs text-gray-500 mt-0.5">
                    {hit.location}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
