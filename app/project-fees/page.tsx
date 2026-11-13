'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backendfornextapp-production.up.railway.app';

interface FeeItem {
  label: string;
  amount: number;
}

interface FeeGenerationRow {
  id: string;
  created_at: string | null;
  source: string;
  user_email: string | null;
  user_name: string | null;
  engineer_name: string | null;
  is_test: boolean;
  synergy_project_ref: string | null;
  synergy_project_label: string | null;
  project_name: string | null;
  client_company_name: string | null;
  has_missing_or_edited: boolean;
  inputs?: {
    client?: {
      first_name?: string;
      surname?: string;
      company_name?: string;
      address_lines?: string[];
    };
    project?: {
      project_name?: string;
      project_location?: string;
      country?: string;
    };
  };
  synergy_context?: {
    dropbox_path?: string;
    revision?: number;
    extraction_method?: string;
    fee_items?: FeeItem[];
    total_fee?: number | null;
    synergy_comparison?: {
      synergy_found?: boolean;
      synergy_number?: string | null;
      synergy_name?: string | null;
      synergy_status?: string | null;
      diffs?: string[];
    };
  } | null;
}

interface SynergyPrefill {
  fields?: {
    clientFirstName?: { value: string | null; status: string };
    clientSurname?: { value: string | null; status: string };
    clientCompanyName?: { value: string | null; status: string };
    clientAddressLines?: { value: string[] | null; status: string };
  };
  projectManager?: { name?: string | null };
  siteAddress?: {
    lines?: string[];
    town?: string | null;
    state?: string | null;
    postcode?: string | null;
    country?: string | null;
  } | null;
  client?: {
    status?: string;
    lookup?: string;
    stale?: boolean;
    reason?: string | null;
    displayName?: string | null;
    contactSuggestions?: Array<{
      id: number;
      displayName: string;
    }>;
  };
}

function formatMoney(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function projectRefCode(row: FeeGenerationRow): string {
  const synNum = row.synergy_context?.synergy_comparison?.synergy_number;
  if (synNum) return synNum;
  if (row.synergy_project_label) {
    const m = row.synergy_project_label.match(/^(\d{4})\b/);
    if (m) return m[1];
  }
  if (row.synergy_project_ref && !row.synergy_project_ref.startsWith('synergy:')) {
    return row.synergy_project_ref;
  }
  return '—';
}

export default function ProjectFeesPage() {
  const [rows, setRows] = useState<FeeGenerationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [engineerFilter, setEngineerFilter] = useState('ALL');
  const [synergyFilter, setSynergyFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'fee' | 'ref'>('date');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [synergyPrefills, setSynergyPrefills] = useState<Record<string, SynergyPrefill>>({});
  const [synergyLoading, setSynergyLoading] = useState<Record<string, boolean>>({});
  const [synergyErrors, setSynergyErrors] = useState<Record<string, string>>({});

  async function loadSynergyContact(ref: string) {
    if (!ref || synergyLoading[ref]) return;
    setSynergyLoading((prev) => ({ ...prev, [ref]: true }));
    setSynergyErrors((prev) => {
      const next = { ...prev };
      delete next[ref];
      return next;
    });
    try {
      const res = await fetch(`/api/synergy-prefill?ref=${encodeURIComponent(ref)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSynergyPrefills((prev) => ({ ...prev, [ref]: body }));
    } catch (err) {
      setSynergyErrors((prev) => ({
        ...prev,
        [ref]: err instanceof Error ? err.message : 'Failed to load Synergy contact',
      }));
    } finally {
      setSynergyLoading((prev) => ({ ...prev, [ref]: false }));
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/word/fee-proposal/generations?limit=500`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: FeeGenerationRow[] = await res.json();
        if (active) {
          setRows(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load project fee history');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const engineers = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.engineer_name) set.add(r.engineer_name);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = rows.filter((r) => {
      if (engineerFilter !== 'ALL' && r.engineer_name !== engineerFilter) return false;
      const synFound = Boolean(r.synergy_context?.synergy_comparison?.synergy_found);
      if (synergyFilter === 'MATCHED' && !synFound) return false;
      if (synergyFilter === 'UNMATCHED' && synFound) return false;

      if (terms.length === 0) return true;
      const client = r.inputs?.client;
      const project = r.inputs?.project;
      const feeLabels = (r.synergy_context?.fee_items || []).map((f) => f.label).join(' ');
      const haystack = [
        projectRefCode(r),
        r.synergy_project_label,
        r.project_name,
        r.client_company_name,
        client?.first_name,
        client?.surname,
        ...(client?.address_lines || []),
        project?.project_location,
        r.engineer_name,
        r.synergy_context?.dropbox_path,
        feeLabels,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });

    list.sort((a, b) => {
      if (sortBy === 'fee') {
        return (b.synergy_context?.total_fee ?? -1) - (a.synergy_context?.total_fee ?? -1);
      }
      if (sortBy === 'ref') {
        return projectRefCode(a).localeCompare(projectRefCode(b));
      }
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    return list;
  }, [rows, query, engineerFilter, synergyFilter, sortBy]);

  const stats = useMemo(() => {
    const fees = filtered
      .map((r) => r.synergy_context?.total_fee)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v) && v > 0)
      .sort((a, b) => a - b);
    const totalValue = fees.reduce((acc, v) => acc + v, 0);
    const median = fees.length ? fees[Math.floor(fees.length / 2)] : null;
    const matched = filtered.filter((r) => r.synergy_context?.synergy_comparison?.synergy_found).length;
    return { count: filtered.length, totalValue, median, matched };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              ← Back to Toolstation
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Project &amp; Fee History</h1>
            <p className="text-sm text-gray-500">
              Search previous FD fee proposal data
            </p>
          </div>
          <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            {loading ? 'Loading…' : `${rows.length} records loaded`}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Project ref, name, client, location, scope…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Engineer</label>
              <select
                value={engineerFilter}
                onChange={(e) => setEngineerFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="ALL">All engineers</option>
                {engineers.map((eng) => (
                  <option key={eng} value={eng}>
                    {eng}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Synergy Match</label>
              <select
                value={synergyFilter}
                onChange={(e) => setSynergyFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="ALL">All</option>
                <option value="MATCHED">Matched in Synergy</option>
                <option value="UNMATCHED">Unmatched</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'fee' | 'ref')}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="date">Newest first</option>
                <option value="fee">Highest fee</option>
                <option value="ref">Project ref</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-white border border-gray-200 rounded-xl p-3.5">
            <div className="text-xs text-gray-500">Matching Proposals</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5">{stats.count}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3.5">
            <div className="text-xs text-gray-500">Matched in Synergy</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5">{stats.matched}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3.5">
            <div className="text-xs text-gray-500">Median Quoted Fee</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5">{formatMoney(stats.median)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3.5">
            <div className="text-xs text-gray-500">Total Quoted Value</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5">{formatMoney(stats.totalValue)}</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm">
            Failed to load records: {error}
          </div>
        )}

        {/* Results Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Ref</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Engineer</th>
                  <th className="px-4 py-3 text-right">Fee</th>
                  <th className="px-4 py-3">Synergy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      No matching proposals found.
                    </td>
                  </tr>
                )}
                {filtered.map((row) => {
                  const isOpen = expandedId === row.id;
                  const ref = projectRefCode(row);
                  const client = row.inputs?.client;
                  const project = row.inputs?.project;
                  const syn = row.synergy_context?.synergy_comparison;
                  const feeItems = row.synergy_context?.fee_items || [];
                  const totalFee = row.synergy_context?.total_fee;
                  const contactName = [client?.first_name, client?.surname].filter(Boolean).join(' ');

                  return (
                    <Fragment key={row.id}>
                      <tr
                        onClick={() => setExpandedId(isOpen ? null : row.id)}
                        className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 whitespace-nowrap">
                          {ref}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.project_name || '—'}</div>
                          {project?.project_location && (
                            <div className="text-xs text-gray-500">{project.project_location}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900">{row.client_company_name || '—'}</div>
                          {contactName && <div className="text-xs text-gray-500">{contactName}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.engineer_name || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                          {formatMoney(totalFee)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {syn?.synergy_found ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Matched
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              Unmatched
                            </span>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${row.id}-detail`} className="bg-gray-50/80">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div>
                                <div className="font-semibold text-gray-700 mb-1">Client &amp; Address</div>
                                <div className="text-gray-800">{client?.company_name || '—'}</div>
                                {contactName && <div className="text-gray-600">{contactName}</div>}
                                {(client?.address_lines || []).length > 0 && (
                                  <div className="text-gray-500 mt-1 space-y-0.5">
                                    {client?.address_lines?.map((line, i) => (
                                      <div key={i}>{line}</div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <div className="font-semibold text-gray-700 mb-1">Fee Breakdown</div>
                                {feeItems.length === 0 ? (
                                  <div className="text-gray-500">No line items extracted</div>
                                ) : (
                                  <ul className="space-y-1">
                                    {feeItems.map((item, i) => (
                                      <li key={i} className="flex justify-between gap-2 text-gray-700">
                                        <span className="truncate">{item.label || 'Fee item'}</span>
                                        <span className="font-medium whitespace-nowrap">
                                          {formatMoney(item.amount)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              <div>
                                <div className="font-semibold text-gray-700 mb-1">Synergy &amp; Source</div>
                                <div className="text-gray-700">
                                  Synergy: {row.synergy_project_label || 'Not matched'}
                                </div>
                                <div className="text-gray-500 mt-1">
                                  Source: <span className="font-mono">{row.source}</span>
                                  {typeof row.synergy_context?.revision === 'number' &&
                                    row.synergy_context.revision >= 0 &&
                                    ` · Rev ${String(row.synergy_context.revision).padStart(2, '0')}`}
                                </div>
                                {row.synergy_context?.dropbox_path && (
                                  <div className="text-gray-500 mt-1 break-all font-mono">
                                    {row.synergy_context.dropbox_path}
                                  </div>
                                )}

                                {row.synergy_project_ref?.startsWith('synergy:') && (
                                  <div className="mt-3 pt-2 border-t border-gray-200">
                                    {!synergyPrefills[row.synergy_project_ref] ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          loadSynergyContact(row.synergy_project_ref!);
                                        }}
                                        disabled={Boolean(synergyLoading[row.synergy_project_ref])}
                                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                                      >
                                        {synergyLoading[row.synergy_project_ref]
                                          ? 'Loading Synergy contact…'
                                          : 'View Synergy Contact'}
                                      </button>
                                    ) : (
                                      (() => {
                                        const pre = synergyPrefills[row.synergy_project_ref!];
                                        const f = pre.fields;
                                        const synName = [f?.clientFirstName?.value, f?.clientSurname?.value]
                                          .filter(Boolean)
                                          .join(' ');
                                        const synCompany = f?.clientCompanyName?.value;
                                        const synAddr = f?.clientAddressLines?.value || [];
                                        const staff = pre.client?.contactSuggestions || [];
                                        return (
                                          <div className="space-y-1.5">
                                            <div className="font-semibold text-indigo-700">
                                              Synergy Client ({pre.client?.status || pre.client?.lookup || 'loaded'})
                                            </div>
                                            {synCompany && <div className="text-gray-900 font-medium">{synCompany}</div>}
                                            {synName && <div className="text-gray-700">{synName}</div>}
                                            {synAddr.length > 0 && (
                                              <div className="text-gray-500">
                                                {synAddr.join(', ')}
                                              </div>
                                            )}
                                            {pre.projectManager?.name && (
                                              <div className="text-gray-600">
                                                PM: {pre.projectManager.name}
                                              </div>
                                            )}
                                            {staff.length > 0 && (
                                              <div className="pt-1">
                                                <div className="text-gray-500 mb-1">Company staff in Synergy:</div>
                                                <div className="flex flex-wrap gap-1">
                                                  {staff.map((s) => (
                                                    <span
                                                      key={s.id}
                                                      className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200"
                                                    >
                                                      {s.displayName}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()
                                    )}
                                    {synergyErrors[row.synergy_project_ref] && (
                                      <div className="text-red-600 mt-1">
                                        {synergyErrors[row.synergy_project_ref]}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
