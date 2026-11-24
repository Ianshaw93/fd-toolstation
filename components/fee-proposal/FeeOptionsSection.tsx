'use client';

import { Dispatch, useState } from 'react';
import { BUSINESS_TERMS_PRESETS, formatTermsPreview, getBusinessTermsPreset } from '../../lib/business-terms';
import type { FeeOptions, Engineer } from '../../lib/fee-types';
import type { FieldProvenance } from '../../lib/field-provenance';
import SourceBadge from './SourceBadge';

interface Props {
  feeOptions: FeeOptions;
  engineers: Engineer[];
  dispatch: Dispatch<any>;
  /** Word task pane only: where an autofilled engineer came from. */
  provenance?: Pick<FieldProvenance, 'engineer'>;
  /** Word task pane only: per-proposal wording overrides & live preview. */
  textOverrides?: Record<string, string>;
  vatApplies?: boolean;
  showTermsPreview?: boolean;
}

export default function FeeOptionsSection({
  feeOptions,
  engineers,
  dispatch,
  provenance,
  textOverrides,
  vatApplies = true,
  showTermsPreview = false,
}: Props) {
  const [editingTerms, setEditingTerms] = useState(false);
  const preset = getBusinessTermsPreset(feeOptions.business_terms);
  const overrides = textOverrides ?? {};
  const piiText = overrides[preset.piiKey] ?? preset.piiTemplate;
  const contractText = overrides[preset.contractKey] ?? preset.contractTemplate;
  const invoicingText = overrides[preset.invoicingKey] ?? preset.invoicingTemplate;
  const isCustomized =
    preset.piiKey in overrides || preset.contractKey in overrides || preset.invoicingKey in overrides;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-sm font-medium text-gray-700">Engineer Name</label>
          <SourceBadge provenance={provenance?.engineer} testId="source-engineer" />
        </div>
        <select
          value={feeOptions.engineer_name}
          onChange={(e) => dispatch({ type: 'SET_FEE_OPTIONS', field: 'engineer_name', value: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        >
          <option value="">Select Engineer</option>
          {engineers.map((eng) => (
            <option key={eng.full_name} value={eng.full_name}>
              {eng.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Business Terms</label>
        <select
          value={preset.id}
          onChange={(e) => dispatch({ type: 'SET_FEE_OPTIONS', field: 'business_terms', value: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        >
          {BUSINESS_TERMS_PRESETS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">PII Limit (£)</label>
        <input
          type="number"
          value={feeOptions.pii_limit}
          onChange={(e) => dispatch({ type: 'SET_FEE_OPTIONS', field: 'pii_limit', value: parseInt(e.target.value) || 0 })}
          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
      </div>
      <div className="md:col-span-3 flex items-center pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={feeOptions.include_hourly_rates}
            onChange={(e) => dispatch({ type: 'SET_FEE_OPTIONS', field: 'include_hourly_rates', value: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-gray-700">Include Hourly Rates</span>
        </label>
      </div>
      {showTermsPreview && (
        <div
          data-testid="terms-letter-preview"
          className="md:col-span-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-800"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              On the letter — Terms of Business
            </span>
            <div className="flex items-center gap-2">
              {isCustomized && (
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'RESET_TEXT_OVERRIDES',
                      keys: [preset.piiKey, preset.contractKey, preset.invoicingKey],
                    })
                  }
                  className="text-[11px] text-gray-600 hover:text-gray-900 underline"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingTerms((v) => !v)}
                className="text-[11px] font-medium text-blue-700 hover:underline"
              >
                {editingTerms ? 'Done' : 'Edit wording'}
              </button>
            </div>
          </div>
          {editingTerms ? (
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">PII paragraph</label>
                <textarea
                  rows={2}
                  value={piiText}
                  onChange={(e) => dispatch({ type: 'SET_TEXT_OVERRIDE', key: preset.piiKey, value: e.target.value })}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Contractual terms</label>
                <textarea
                  rows={3}
                  value={contractText}
                  onChange={(e) => dispatch({ type: 'SET_TEXT_OVERRIDE', key: preset.contractKey, value: e.target.value })}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Invoicing</label>
                <textarea
                  rows={2}
                  value={invoicingText}
                  onChange={(e) => dispatch({ type: 'SET_TEXT_OVERRIDE', key: preset.invoicingKey, value: e.target.value })}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 leading-relaxed">
              <p>{formatTermsPreview(piiText, feeOptions.pii_limit, vatApplies)}</p>
              <p>{formatTermsPreview(contractText, feeOptions.pii_limit, vatApplies)}</p>
              <p>{formatTermsPreview(invoicingText, feeOptions.pii_limit, vatApplies)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
