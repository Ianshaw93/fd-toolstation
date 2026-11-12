'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { errorNotice } from '../../lib/directory-prefill';
import { NESTED_APP_AUTH_UNAVAILABLE, type FdSignIn } from '../../lib/fd-msal';
import { logSynergyProjectOpen, searchDirectoryProjects } from '../../lib/synergy-api';
import { DirectoryError, type DirectoryProject } from '../../lib/vendor/fd-directory-client';

interface Props {
  selectedRef?: string | null;
  selectedLabel?: string;
  onSelect: (project: DirectoryProject) => void;
  onUnlink: () => void;
  /** FD Microsoft sign-in. Omitted in tests that only exercise search. */
  signIn?: FdSignIn;
  /** Extra content inside the linked-project card, under the project label. */
  linkedDetail?: ReactNode;
}

const MIN_QUERY = 2;

function marker(project: DirectoryProject): string | null {
  if (project.missingSince) return 'Missing in Synergy';
  if (project.isArchived) return 'Archived';
  if (project.isActive === false) return 'Inactive';
  return null;
}

export default function SynergyProjectPicker({ selectedRef, selectedLabel, onSelect, onUnlink, signIn, linkedDetail }: Props) {
  const [query, setQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [results, setResults] = useState<DirectoryProject[]>([]);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canSearch = !signIn || signIn.state === 'signed_in';

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const q = query.trim();
    if (q.length < MIN_QUERY || !canSearch) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const page = await searchDirectoryProjects(q, { includeInactive, signal: controller.signal });
        setResults(page.items);
        setStale(page.meta.stale);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof DirectoryError ? errorNotice(err.code) : 'The project directory could not be reached.');
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, includeInactive, canSearch]);

  const handleSelect = (project: DirectoryProject, rank: number) => {
    onSelect(project);
    logSynergyProjectOpen(project.organisationId, project.synergyProjectId, rank);
    setIsSearching(false);
    setQuery('');
    setResults([]);
  };

  if (selectedRef) {
    return (
      <div data-testid="linked-synergy-project" className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 space-y-2">
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
        <div className="text-sm font-semibold text-gray-900 leading-snug">{selectedLabel || 'Selected Project'}</div>
        {linkedDetail}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <label htmlFor="synergy-search-input" className="block text-xs font-semibold text-gray-700">
          Synergy Project <span className="font-normal text-gray-500">(Optional)</span>
        </label>
        <div className="flex items-center gap-2">
          {signIn?.state === 'signed_in' && signIn.account && (
            <span
              className="text-2xs text-emerald-700 flex items-center gap-1 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
              title={`Signed in as ${signIn.account.username}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {signIn.account.name || signIn.account.username}
            </span>
          )}
          {stale && (
            <span className="text-2xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
              Directory sync is stale
            </span>
          )}
        </div>
      </div>

      {signIn && signIn.state === 'needs_sign_in' && (
        <div className="rounded-md border border-sky-200 bg-white p-2.5 text-xs text-gray-700 space-y-2">
          <p>Sign in with Microsoft to search the project directory. Your FD account is used; nothing else is created.</p>
          {signIn.reason && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{signIn.reason}</p>
          )}
          <button
            type="button"
            onClick={() => void signIn.signIn()}
            className="px-3 py-1.5 rounded-md bg-gray-900 text-white font-medium"
          >
            Sign in with Microsoft
          </button>
        </div>
      )}
      {signIn && signIn.state === 'unavailable' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 space-y-2">
          {signIn.reason && <p>{signIn.reason}</p>}
          {signIn.reason !== NESTED_APP_AUTH_UNAVAILABLE && (
            <button
              type="button"
              onClick={() => void signIn.signIn()}
              className="px-3 py-1.5 rounded-md bg-amber-900 text-white font-medium"
            >
              Try signing in
            </button>
          )}
        </div>
      )}
      {signIn && signIn.state === 'checking' && <p className="text-xs text-gray-500">Checking your Microsoft sign-in…</p>}

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

      {isSearching && query.trim().length >= MIN_QUERY && canSearch && (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm divide-y divide-gray-100 max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-xs text-gray-500 text-center">Searching the project directory…</div>
          ) : error ? (
            <div className="p-3 text-xs text-rose-600">{error}</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-gray-500">No matching projects. You can enter details manually below.</div>
          ) : (
            results.map((project, idx) => {
              const flag = marker(project);
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleSelect(project, idx)}
                  className="w-full text-left p-2.5 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-900">{project.label}</span>
                    {flag ? (
                      <span className="text-2xs px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-600 border border-gray-200">{flag}</span>
                    ) : project.status.name ? (
                      <span className="text-2xs px-1.5 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {project.status.name}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
