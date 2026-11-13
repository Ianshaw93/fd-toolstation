'use client';

import { useState, type Dispatch } from 'react';
import { COUNTRIES } from '../../lib/fee-constants';
import type { PreviousOptionField } from '../../hooks/useFeeProposal';
import type { PreviousFeeOption } from '../../lib/word-addin-api';

interface OptionItem {
  key: string;
  source: 'synergy' | 'previous_fee';
  value: unknown;
  meta: string | null;
}

const normText = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

function optionKey(field: PreviousOptionField, value: unknown): string {
  if (field === 'address' && Array.isArray(value)) {
    return value.map(normText).filter(Boolean).join('\n');
  }
  if (field === 'names' && typeof value === 'object' && value !== null) {
    const v = value as { firstName?: string; lastName?: string };
    return `${normText(v.firstName)}|${normText(v.lastName)}`;
  }
  return normText(value);
}

function isNonEmpty(field: PreviousOptionField, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (field === 'address') return Array.isArray(value) && value.some((l) => String(l ?? '').trim() !== '');
  if (field === 'names') {
    const v = value as { firstName?: string; lastName?: string };
    return Boolean((v.firstName ?? '').trim() || (v.lastName ?? '').trim());
  }
  return String(value).trim() !== '';
}

function formatMeta(opt: PreviousFeeOption): string | null {
  const parts: string[] = [];
  if (opt.by) parts.push(opt.by.split(' ')[0] ?? opt.by);
  if (opt.count > 1) parts.push(`${opt.count}×`);
  else if (opt.latest_at) {
    const d = new Date(opt.latest_at);
    if (!Number.isNaN(d.getTime())) {
      parts.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    }
  }
  return parts.length ? parts.join(' · ') : null;
}

function formatDisplay(field: PreviousOptionField, value: unknown): string {
  if (field === 'address' && Array.isArray(value)) {
    return value.map((l) => String(l ?? '').trim()).filter(Boolean).join('\n');
  }
  if (field === 'names' && typeof value === 'object' && value !== null) {
    const v = value as { firstName?: string; lastName?: string };
    return [v.firstName, v.lastName].filter(Boolean).join(' ');
  }
  if (field === 'country') {
    return COUNTRIES.find((c) => c.value === value)?.label ?? String(value);
  }
  return String(value ?? '');
}

interface Props {
  field: PreviousOptionField;
  label: string;
  synergyValue?: unknown;
  previousOptions?: PreviousFeeOption[];
  currentValue: unknown;
  dispatch: Dispatch<{ type: 'PICK_PREVIOUS_OPTION'; field: PreviousOptionField; source: 'synergy' | 'previous_fee'; value: unknown }>;
}

export default function PreviousOptionPicker({
  field,
  label,
  synergyValue,
  previousOptions = [],
  currentValue,
  dispatch,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const items: OptionItem[] = [];
  const seen = new Set<string>();

  if (isNonEmpty(field, synergyValue)) {
    const k = optionKey(field, synergyValue);
    seen.add(k);
    items.push({ key: k, source: 'synergy', value: synergyValue, meta: null });
  }

  for (const opt of previousOptions) {
    if (!isNonEmpty(field, opt.value)) continue;
    const k = optionKey(field, opt.value);
    if (seen.has(k)) continue;
    seen.add(k);
    items.push({ key: k, source: 'previous_fee', value: opt.value, meta: formatMeta(opt) });
  }

  const hasPrevious = items.some((item) => item.source === 'previous_fee');
  if (!hasPrevious) return null;

  const currentKey = optionKey(field, currentValue);

  if (field === 'address') {
    const compactByDefault = items.length >= 3;
    return (
      <div className="mt-2 space-y-1.5" data-testid={`previous-options-${field}`}>
        <p className="text-xs font-medium text-gray-600">{label} options</p>
        {items.map((item) => {
          const selected = currentKey !== '' && currentKey === item.key;
          const full = formatDisplay(field, item.value);
          const preview = full.split('\n').join(', ');
          const isExpanded = !compactByDefault || !!expanded[item.key] || selected;
          const sourceLabel = item.source === 'synergy' ? 'Total Synergy' : 'Previous fee';
          const badgeTone =
            item.source === 'synergy'
              ? 'border-sky-200 bg-sky-50 text-sky-800'
              : 'border-indigo-200 bg-indigo-50 text-indigo-800';
          return (
            <div
              key={item.key}
              className={`rounded-md border p-2 text-xs transition-colors ${
                selected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] leading-none ${badgeTone}`}>
                    {sourceLabel}
                  </span>
                  {item.meta && <span className="text-[11px] text-gray-500">{item.meta}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {compactByDefault && !selected && (
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className="text-[11px] text-gray-600 underline hover:text-gray-900"
                    >
                      {isExpanded ? 'Hide' : 'Show full'}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => dispatch({ type: 'PICK_PREVIOUS_OPTION', field, source: item.source, value: item.value })}
                    className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                      selected
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {selected ? 'Selected' : 'Use'}
                  </button>
                </div>
              </div>
              <p className={`mt-1.5 text-gray-800 ${isExpanded ? 'whitespace-pre-line' : 'truncate'}`}>
                {isExpanded ? full : preview}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-1.5" data-testid={`previous-options-${field}`}>
      <p className="mb-1 text-xs font-medium text-gray-600">{label} options</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const selected = currentKey !== '' && currentKey === item.key;
          const display = formatDisplay(field, item.value);
          const tag = item.source === 'synergy' ? 'Synergy' : item.meta ? `Prev fee · ${item.meta}` : 'Prev fee';
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={selected}
              onClick={() => dispatch({ type: 'PICK_PREVIOUS_OPTION', field, source: item.source, value: item.value })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-400 ${
                selected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>{display}</span>
              <span
                className={`rounded px-1 py-0.5 text-[10px] leading-none ${
                  selected
                    ? 'bg-gray-700 text-gray-100'
                    : item.source === 'synergy'
                      ? 'bg-sky-50 text-sky-800'
                      : 'bg-indigo-50 text-indigo-800'
                }`}
              >
                {tag}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
