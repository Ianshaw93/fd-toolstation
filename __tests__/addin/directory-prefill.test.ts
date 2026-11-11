import {
  CLIENT_LOOKUP_PENDING_NOTICE,
  isFeeProposalPrefillV1,
  outcomeNotice,
  pollFeeProposalPrefill,
  prefillNotice,
} from '../../lib/directory-prefill';
import { applyFeeProposalPrefill, DirectoryError, type PrefillTarget } from '../../lib/vendor/fd-directory-client';
import { pending, pending0406, served, served0406, served0406WithContacts, SERVED_REF, REF_0406, withCompanyContacts } from '../../test-fixtures/directory-contract-v1';

const DEFAULTS: PrefillTarget = {
  projectName: '',
  projectCountry: 'EW',
  clientFirstName: '',
  clientSurname: '',
  clientCompanyName: '',
  clientAddressLines: ['', '', '', '', '', ''],
};

describe('contractVersion 1 guard', () => {
  it('accepts the documented served and pending payloads', () => {
    expect(isFeeProposalPrefillV1(served())).toBe(true);
    expect(isFeeProposalPrefillV1(pending())).toBe(true);
    const failed = served();
    failed.client = { ...failed.client, lookup: 'failed', status: null, errorCode: 'synergy_timeout' };
    expect(isFeeProposalPrefillV1(failed)).toBe(true);
  });

  it('rejects other shapes', () => {
    expect(isFeeProposalPrefillV1({ ...served(), contractVersion: 2 })).toBe(false);
    expect(isFeeProposalPrefillV1({ company_name: { value: 'X', status: 'present', source: null } })).toBe(false);
    const noField = served() as unknown as { fields: Record<string, unknown> };
    delete noField.fields.clientCompanyName;
    expect(isFeeProposalPrefillV1(noField)).toBe(false);
  });
});

describe('shared applyFeeProposalPrefill on the documented payload', () => {
  it('fills the company and the exact addressHome lines, leaves the person, and flags review', () => {
    const merged = applyFeeProposalPrefill({ current: DEFAULTS, defaults: DEFAULTS, prefill: served0406(), selectedRef: REF_0406 });
    expect(merged.values.clientCompanyName).toBe('Taylor Wimpey North Thames');
    expect(merged.values.clientFirstName).toBe('');
    expect(merged.values.clientSurname).toBe('');
    expect(merged.values.clientAddressLines).toEqual(['The Dock,', 'Station road, Kings Langley', 'Hertfordshire', 'WD4 8LZ', 'United Kingdom', '']);
    expect(merged.values.projectCountry).toBe('EW');
    expect(merged.skipped).toContainEqual({ field: 'projectCountry', reason: 'unrecognised' });
    expect(merged.needsReview).toEqual([{ field: 'clientAddressLines', review: ['home_slot_on_company_record', 'hasAddress_false'] }]);
    // The address field itself shows why it needs review; the client notice stays quiet.
    expect(prefillNotice(served0406())).toBeNull();
  });

  it('applies the documented Wales country as EW', () => {
    const merged = applyFeeProposalPrefill({ current: { ...DEFAULTS, projectCountry: 'EW' }, defaults: DEFAULTS, prefill: served(), selectedRef: SERVED_REF });
    expect(merged.applied.projectCountry).toBe('EW');
  });

  it('ignores a response for another selection', () => {
    const merged = applyFeeProposalPrefill({ current: DEFAULTS, defaults: DEFAULTS, prefill: served(), selectedRef: REF_0406 });
    expect(merged.applied).toEqual({});
    expect(merged.values.clientCompanyName).toBe('');
  });
});

describe('prefill notices', () => {
  it('says the lookup is pending', () => {
    expect(prefillNotice(pending0406())).toBe(CLIENT_LOOKUP_PENDING_NOTICE);
  });

  it('explains each documented client status without guessing a client', () => {
    const body = served0406();
    body.client = { ...body.client, status: 'no_client_role', displayName: null };
    expect(prefillNotice(body)).toMatch(/no Client role/i);
    body.client = { ...body.client, status: 'multiple_client_roles', candidates: [{ projectContactId: 1, contactId: 2, name: 'A Ltd' }, { projectContactId: 3, contactId: 4, name: 'B Ltd' }] };
    expect(prefillNotice(body)).toMatch(/A Ltd.*B Ltd/);
    body.client = { ...body.client, status: 'contact_detail_missing' };
    expect(prefillNotice(body)).toMatch(/could not be read/i);
    body.client = { ...body.client, lookup: 'failed', status: null, errorCode: 'synergy_timeout' };
    expect(prefillNotice(body)).toMatch(/failed.*synergy_timeout/i);
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

  it('asks again with backoff until the lookup is no longer pending', async () => {
    const clock = fakeClock();
    const bodies = [pending0406(), pending0406(), served0406WithContacts()];
    const fetchPrefill = jest.fn(async () => bodies.shift() ?? null);
    const seen: string[] = [];
    const outcome = await pollFeeProposalPrefill(REF_0406, {
      fetchPrefill,
      signal: new AbortController().signal,
      onResponse: (body) => seen.push(body.client.lookup),
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(outcome.kind).toBe('done');
    expect(seen).toEqual(['pending', 'pending', 'done']);
    expect(clock.waits[1]).toBeGreaterThan(clock.waits[0]);
  });

  it('keeps asking while the company people are pending after the Client lookup is done', async () => {
    const clock = fakeClock();
    const bodies = [pending0406(), served0406(), served0406(), served0406WithContacts()];
    const fetchPrefill = jest.fn(async () => bodies.shift() ?? null);
    const seen: string[] = [];
    const outcome = await pollFeeProposalPrefill(REF_0406, {
      fetchPrefill,
      signal: new AbortController().signal,
      onResponse: (body) => seen.push(`${body.client.lookup}/${body.client.companyContacts.lookup}`),
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(outcome.kind).toBe('done');
    expect(seen).toEqual(['pending/not_applicable', 'done/pending', 'done/pending', 'done/done']);
  });

  it('stops once the company people lookup has failed or does not apply', async () => {
    for (const lookup of ['failed', 'not_applicable'] as const) {
      const clock = fakeClock();
      const fetchPrefill = jest.fn(async () => withCompanyContacts(served0406(), { lookup }));
      const outcome = await pollFeeProposalPrefill(REF_0406, { fetchPrefill, signal: new AbortController().signal, onResponse: () => undefined, now: clock.now, sleep: clock.sleep });
      expect(outcome.kind).toBe('done');
      expect(fetchPrefill).toHaveBeenCalledTimes(1);
    }
  });

  it('stops on a failed lookup', async () => {
    const clock = fakeClock();
    const failed = served0406();
    failed.client = { ...failed.client, lookup: 'failed', status: null, errorCode: 'synergy_timeout' };
    const fetchPrefill = jest.fn(async () => failed);
    const outcome = await pollFeeProposalPrefill(REF_0406, { fetchPrefill, signal: new AbortController().signal, onResponse: () => undefined, now: clock.now, sleep: clock.sleep });
    expect(outcome.kind).toBe('done');
    expect(fetchPrefill).toHaveBeenCalledTimes(1);
  });

  it('stops at the deadline instead of polling forever', async () => {
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
    const onResponse = jest.fn();
    const outcome = await pollFeeProposalPrefill(REF_0406, {
      fetchPrefill: async () => {
        controller.abort();
        return pending0406();
      },
      signal: controller.signal,
      onResponse,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(outcome.kind).toBe('aborted');
    expect(onResponse).not.toHaveBeenCalled();
  });

  it('does not retry sign-in, auth, or configuration failures, and retries a network error', async () => {
    for (const code of ['interaction_required', 'unauthorized', 'not_configured', 'wrong_audience'] as const) {
      const clock = fakeClock();
      const fetchPrefill = jest.fn(async () => {
        throw new DirectoryError(code);
      });
      const outcome = await pollFeeProposalPrefill(REF_0406, { fetchPrefill, signal: new AbortController().signal, onResponse: () => undefined, now: clock.now, sleep: clock.sleep });
      expect(outcome).toMatchObject({ kind: 'error', code });
      expect(fetchPrefill).toHaveBeenCalledTimes(1);
    }
    const clock = fakeClock();
    let calls = 0;
    const outcome = await pollFeeProposalPrefill(REF_0406, {
      fetchPrefill: async () => {
        calls += 1;
        if (calls === 1) throw new DirectoryError('network_error');
        return served0406WithContacts();
      },
      signal: new AbortController().signal,
      onResponse: () => undefined,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(outcome.kind).toBe('done');
  });

  it('reports an unknown project and a body that is not the contract', async () => {
    const clock = fakeClock();
    const base = { signal: new AbortController().signal, onResponse: jest.fn(), now: clock.now, sleep: clock.sleep };
    expect((await pollFeeProposalPrefill(REF_0406, { ...base, fetchPrefill: async () => null })).kind).toBe('not_found');
    const other = await pollFeeProposalPrefill(REF_0406, { ...base, fetchPrefill: async () => ({ company_name: 'x' }) as never });
    expect(other.kind).toBe('contract_mismatch');
    expect(base.onResponse).not.toHaveBeenCalled();
  });

  it('turns outcomes into plain notices', () => {
    expect(outcomeNotice({ kind: 'error', code: 'interaction_required' })).toMatch(/sign in with Microsoft/i);
    expect(outcomeNotice({ kind: 'error', code: 'not_configured' })).toMatch(/not configured/i);
    expect(outcomeNotice({ kind: 'timeout' })).toMatch(/by hand/i);
    expect(outcomeNotice({ kind: 'done' })).toBeNull();
  });
});
