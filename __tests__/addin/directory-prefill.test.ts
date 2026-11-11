import {
  applyDirectoryPrefill,
  parseFeeProposalPrefillV1,
  pollFeeProposalPrefill,
  CLIENT_LOOKUP_PENDING_NOTICE,
} from '../../lib/directory-prefill';
import type { FeeAutofillState } from '../../lib/synergy-client-enrichment';
import { done0406, LABEL_0406, pending0406, REF_0406 } from '../../test-fixtures/directory-prefill-0406';

const ENGINEERS = ['Ada Lovelace', 'Sam Bennett'];

function blank(): FeeAutofillState {
  return {
    company_name: '',
    first_name: '',
    surname: '',
    address_lines: ['', '', '', '', '', ''],
    project_name: '',
    project_location: '',
    country: 'EW',
    country_touched: false,
    engineer_name: '',
    pii_limit: 100000,
    include_hourly_rates: false,
    autofill: null,
  };
}

function parsed(payload: unknown) {
  const result = parseFeeProposalPrefillV1(payload);
  if (!result.ok) throw new Error(`fixture rejected: ${result.reason}`);
  return result.response;
}

describe('directory fee-proposal-prefill contractVersion 1', () => {
  it('reads the 0406 envelope and keeps the synergy ref as the project id', () => {
    const response = parsed(done0406());
    expect(response.ref).toBe(REF_0406);
    expect(response.label).toBe(LABEL_0406);
    expect(response.clientLookup).toBe('done');
    expect(response.clientStatus).toBe('found');
  });

  it('rejects anything that is not contractVersion 1 with all ten fields', () => {
    expect(parseFeeProposalPrefillV1({ ...done0406(), contractVersion: 2 }).ok).toBe(false);
    const missing = done0406() as { fields: Record<string, unknown> };
    delete missing.fields.clientCompanyName;
    expect(parseFeeProposalPrefillV1(missing).ok).toBe(false);
    expect(parseFeeProposalPrefillV1({ company_name: { value: 'X', status: 'present', source: null } }).ok).toBe(false);
    const noRef = done0406() as { project: { id: unknown } };
    noRef.project.id = 2694397;
    expect(parseFeeProposalPrefillV1(noRef).ok).toBe(false);
  });

  it('fills the Client-role company and exact company address, leaves the person blank', () => {
    const next = applyDirectoryPrefill(blank(), parsed(done0406()), REF_0406, ENGINEERS);
    expect(next.company_name).toBe('Taylor Wimpey North Thames');
    expect(next.first_name).toBe('');
    expect(next.surname).toBe('');
    expect(next.address_lines).toEqual([
      'The Dock,',
      'Station road, Kings Langley',
      'Hertfordshire',
      'WD4 8LZ',
      'United Kingdom',
      '',
    ]);
    expect(next.notice).toMatch(/needs review/i);
  });

  it('does not use the site address, the project manager, or the address country', () => {
    const next = applyDirectoryPrefill(blank(), parsed(done0406()), REF_0406, ENGINEERS);
    expect(next.project_location).toBe('');
    expect(next.address_lines.join('|')).not.toContain('Ballards Lane');
    expect(next.engineer_name).toBe('');
    expect(next.country).toBe('EW');
    expect(next.autofill?.country).toBeUndefined();
  });

  it('keeps project country manual for an unknown or UK value', () => {
    const uk = done0406();
    uk.fields.projectCountry = { value: 'United Kingdom' as never, status: 'found', source: 'x' };
    const parsedUk = parseFeeProposalPrefillV1(uk);
    const state = { ...blank(), country: 'J' as const, country_touched: true };
    if (parsedUk.ok) {
      const next = applyDirectoryPrefill(state, parsedUk.response, REF_0406, ENGINEERS);
      expect(next.country).toBe('J');
    }
    const unknown = done0406();
    unknown.fields.projectCountry = { value: 'UK' as never, status: 'found', source: 'x' };
    const parsedUnknown = parseFeeProposalPrefillV1(unknown);
    if (parsedUnknown.ok) {
      expect(applyDirectoryPrefill(blank(), parsedUnknown.response, REF_0406, ENGINEERS).autofill?.country).toBeUndefined();
    }
  });

  it('applies PII and hourly rates only when the field is verified', () => {
    const unverified = done0406();
    unverified.fields.piiLimit = { value: 5000000 as never, status: 'found', source: 'x' };
    unverified.fields.includeHourlyRates = { value: true as never, status: 'found', source: 'x' };
    const keep = applyDirectoryPrefill(blank(), parsed(unverified), REF_0406, ENGINEERS);
    expect(keep.pii_limit).toBe(100000);
    expect(keep.include_hourly_rates).toBe(false);

    const verified = done0406();
    verified.fields.piiLimit = { value: 5000000 as never, status: 'verified', source: 'x' };
    verified.fields.includeHourlyRates = { value: true as never, status: 'verified', source: 'x' };
    const applied = applyDirectoryPrefill(blank(), parsed(verified), REF_0406, ENGINEERS);
    expect(applied.pii_limit).toBe(5000000);
    expect(applied.include_hourly_rates).toBe(true);
  });

  it('leaves the four client fields empty while the lookup is pending and says so', () => {
    const next = applyDirectoryPrefill(blank(), parsed(pending0406()), REF_0406, ENGINEERS);
    expect(next.project_name).toBe('Former Homebase Site North Finchley');
    expect(next.company_name).toBe('');
    expect(next.address_lines.every((line) => line === '')).toBe(true);
    expect(next.notice).toBe(CLIENT_LOOKUP_PENDING_NOTICE);
  });

  it('ignores a response for a project that is no longer selected', () => {
    const state = blank();
    const next = applyDirectoryPrefill(state, parsed(done0406()), 'synergy:5466:1', ENGINEERS);
    expect(next).toBe(state);
  });

  it('keeps typed client values and replaces only values it filled', () => {
    const typed = { ...blank(), company_name: 'Typed Co', address_lines: ['1 Typed Street', '', '', '', '', ''] };
    const next = applyDirectoryPrefill(typed, parsed(done0406()), REF_0406, ENGINEERS);
    expect(next.company_name).toBe('Typed Co');
    expect(next.address_lines[0]).toBe('1 Typed Street');
  });

  it('clears filled client values when the lookup finishes without a Client', () => {
    const filled = applyDirectoryPrefill(blank(), parsed(done0406()), REF_0406, ENGINEERS);
    const none = done0406();
    none.client = { lookup: 'done', status: 'not_found' };
    none.fields.clientCompanyName = { value: null as never, status: 'not_found', source: 'x' };
    none.fields.clientAddressLines = { value: null as never, status: 'not_found', source: 'x', review: [] };
    const next = applyDirectoryPrefill(filled, parsed(none), REF_0406, ENGINEERS);
    expect(next.company_name).toBe('');
    expect(next.address_lines.every((line) => line === '')).toBe(true);
    expect(next.notice).toMatch(/no Client/i);
  });
});

describe('pollFeeProposalPrefill', () => {
  function fakeClock() {
    let now = 0;
    const waits: number[] = [];
    return {
      waits,
      now: () => now,
      sleep: async (ms: number, signal: AbortSignal) => {
        if (signal.aborted) throw new DOMException('aborted', 'AbortError');
        waits.push(ms);
        now += ms;
      },
    };
  }

  it('polls a pending client lookup with backoff until it is done', async () => {
    const clock = fakeClock();
    const bodies = [pending0406(), pending0406(), done0406()];
    const fetchPrefill = jest.fn(async () => bodies.shift());
    const seen: string[] = [];
    const outcome = await pollFeeProposalPrefill(REF_0406, {
      fetchPrefill,
      signal: new AbortController().signal,
      onResponse: (response) => seen.push(response.clientLookup),
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(outcome.kind).toBe('done');
    expect(seen).toEqual(['pending', 'pending', 'done']);
    expect(fetchPrefill).toHaveBeenCalledTimes(3);
    expect(clock.waits[1]).toBeGreaterThan(clock.waits[0]);
  });

  it('stops at the deadline and reports a timeout instead of polling forever', async () => {
    const clock = fakeClock();
    const fetchPrefill = jest.fn(async () => pending0406());
    const outcome = await pollFeeProposalPrefill(REF_0406, {
      fetchPrefill,
      signal: new AbortController().signal,
      onResponse: () => undefined,
      now: clock.now,
      sleep: clock.sleep,
      timeoutMs: 6 * 60_000,
    });
    expect(outcome.kind).toBe('timeout');
    expect(clock.now()).toBeLessThanOrEqual(6 * 60_000);
    expect(Math.max(...clock.waits)).toBeLessThanOrEqual(30_000);
    expect(fetchPrefill.mock.calls.length).toBeLessThan(40);
  });

  it('stops when the selection changes', async () => {
    const clock = fakeClock();
    const controller = new AbortController();
    const fetchPrefill = jest.fn(async () => {
      controller.abort();
      return pending0406();
    });
    const onResponse = jest.fn();
    const outcome = await pollFeeProposalPrefill(REF_0406, {
      fetchPrefill,
      signal: controller.signal,
      onResponse,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(outcome.kind).toBe('aborted');
    expect(onResponse).not.toHaveBeenCalled();
    expect(fetchPrefill).toHaveBeenCalledTimes(1);
  });

  it('does not retry an auth or configuration failure', async () => {
    for (const status of [401, 503]) {
      const clock = fakeClock();
      const fetchPrefill = jest.fn(async () => {
        throw Object.assign(new Error('nope'), { status });
      });
      const outcome = await pollFeeProposalPrefill(REF_0406, {
        fetchPrefill,
        signal: new AbortController().signal,
        onResponse: () => undefined,
        now: clock.now,
        sleep: clock.sleep,
      });
      expect(outcome).toMatchObject({ kind: 'error', status });
      expect(fetchPrefill).toHaveBeenCalledTimes(1);
    }
  });

  it('reports a body that is not the contract without applying it', async () => {
    const clock = fakeClock();
    const onResponse = jest.fn();
    const outcome = await pollFeeProposalPrefill(REF_0406, {
      fetchPrefill: async () => ({ company_name: { value: 'X', status: 'present', source: null } }),
      signal: new AbortController().signal,
      onResponse,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(outcome.kind).toBe('contract_mismatch');
    expect(onResponse).not.toHaveBeenCalled();
  });
});
