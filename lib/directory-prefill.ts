// Consumer for the project directory's GET /v1/projects/{id}/fee-proposal-prefill
// (contractVersion 1). Each field is { value, status, source }. The four client fields
// start as lookup_pending until the directory worker has read ProjectContacts/Index for
// the Client role, so the pane polls with backoff and gives up to manual entry.
// siteAddress and projectManager are context only: the site is not the client's address
// and the manager is not the fee engineer.

import {
  applyFeeProposalPrefill,
  releaseClientAutofill,
  type FeeAutofillState,
  type FeeCountry,
  type FeeProposalPrefill,
  type PrefillField,
} from './synergy-client-enrichment';

export const CLIENT_LOOKUP_PENDING_NOTICE =
  'Looking up the Client role for this project. Company and address fill in when it finishes; anything you type is kept.';
export const CLIENT_NOT_FOUND_NOTICE =
  'The directory found no Client on this project. Fill in the company, name, and address by hand.';
export const CLIENT_LOOKUP_TIMEOUT_NOTICE =
  'The Client lookup is still running. Fill in the company, name, and address by hand, or choose the project again later.';

const SYNERGY_REF = /^synergy:(\d+):(\d+)$/;

const FIELD_KEYS = [
  'projectName',
  'projectLocation',
  'projectCountry',
  'engineerName',
  'clientFirstName',
  'clientSurname',
  'clientCompanyName',
  'clientAddressLines',
  'piiLimit',
  'includeHourlyRates',
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];

interface ContractField {
  value: unknown;
  status: string;
  source: string | null;
  review: string[];
}

export interface DirectoryPrefillResponse {
  ref: string;
  label: string;
  stale: boolean;
  clientLookup: 'pending' | 'done';
  clientStatus: string | null;
  prefill: FeeProposalPrefill;
}

export type PrefillParse =
  | { ok: true; response: DirectoryPrefillResponse }
  | { ok: false; reason: 'contract_missing' };

export function parseSynergyRef(ref: string): { organisationId: number; projectId: number } | null {
  const match = SYNERGY_REF.exec(ref);
  return match ? { organisationId: Number(match[1]), projectId: Number(match[2]) } : null;
}

export function parseFeeProposalPrefillV1(payload: unknown): PrefillParse {
  const missing = { ok: false, reason: 'contract_missing' } as const;
  if (!isRecord(payload) || payload.contractVersion !== 1) return missing;
  const project = payload.project;
  if (!isRecord(project) || typeof project.id !== 'string' || !parseSynergyRef(project.id)) return missing;
  if (typeof project.label !== 'string') return missing;
  const client = payload.client;
  if (!isRecord(client) || (client.lookup !== 'pending' && client.lookup !== 'done')) return missing;
  if (!isRecord(payload.fields)) return missing;

  const fields = {} as Record<FieldKey, ContractField>;
  for (const key of FIELD_KEYS) {
    const field = readContractField(payload.fields[key]);
    if (!field) return missing;
    fields[key] = field;
  }
  const source = isRecord(payload.source) ? payload.source : {};

  return {
    ok: true,
    response: {
      ref: project.id,
      label: project.label,
      stale: source.stale === true,
      clientLookup: client.lookup,
      clientStatus: typeof client.status === 'string' ? client.status : null,
      prefill: {
        project_name: textField(fields.projectName),
        project_location: textField(fields.projectLocation),
        country: countryField(fields.projectCountry),
        engineer_name: textField(fields.engineerName),
        first_name: textField(fields.clientFirstName),
        surname: textField(fields.clientSurname),
        company_name: textField(fields.clientCompanyName),
        address_lines: addressField(fields.clientAddressLines),
        pii_limit: verifiedField(fields.piiLimit, 'number'),
        include_hourly_rates: verifiedField(fields.includeHourlyRates, 'boolean'),
      },
    },
  };
}

/** Applies a parsed response only if it is for the project still selected. */
export function applyDirectoryPrefill(
  state: FeeAutofillState,
  response: DirectoryPrefillResponse,
  selectedRef: string | null,
  engineerNames: readonly string[],
): FeeAutofillState & { notice: string | null } {
  if (response.ref !== selectedRef) return state as FeeAutofillState & { notice: string | null };
  const applied = applyFeeProposalPrefill(state, response.prefill, engineerNames);
  if (response.clientLookup === 'pending') {
    return { ...applied, notice: CLIENT_LOOKUP_PENDING_NOTICE };
  }
  if (response.clientStatus !== 'found') {
    return { ...releaseClientAutofill(applied), notice: CLIENT_NOT_FOUND_NOTICE };
  }
  return applied;
}

export type PollOutcome =
  | { kind: 'done'; response: DirectoryPrefillResponse }
  | { kind: 'timeout' }
  | { kind: 'aborted' }
  | { kind: 'contract_mismatch' }
  | { kind: 'error'; status: number | null; message: string };

export const POLL_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000];
// The directory worker is expected to finish a Client lookup within about five minutes.
export const POLL_TIMEOUT_MS = 6 * 60_000;

const TERMINAL_STATUSES = new Set([400, 401, 403, 404, 503]);

export interface PollOptions {
  fetchPrefill: (ref: string, signal: AbortSignal) => Promise<unknown>;
  signal: AbortSignal;
  onResponse: (response: DirectoryPrefillResponse) => void;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  timeoutMs?: number;
  delaysMs?: number[];
}

export async function pollFeeProposalPrefill(ref: string, options: PollOptions): Promise<PollOutcome> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? abortableSleep;
  const delays = options.delaysMs ?? POLL_DELAYS_MS;
  const deadline = now() + (options.timeoutMs ?? POLL_TIMEOUT_MS);
  const { signal } = options;

  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) return { kind: 'aborted' };
    let body: unknown;
    let failure: { status: number | null; message: string } | null = null;
    try {
      body = await options.fetchPrefill(ref, signal);
    } catch (error) {
      if (signal.aborted) return { kind: 'aborted' };
      const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : null;
      failure = { status, message: error instanceof Error ? error.message : 'Project directory request failed.' };
      if (status !== null && TERMINAL_STATUSES.has(status)) return { kind: 'error', ...failure };
    }
    if (signal.aborted) return { kind: 'aborted' };

    if (!failure) {
      const parsed = parseFeeProposalPrefillV1(body);
      if (!parsed.ok || parsed.response.ref !== ref) return { kind: 'contract_mismatch' };
      options.onResponse(parsed.response);
      if (parsed.response.clientLookup === 'done') return { kind: 'done', response: parsed.response };
    }

    const delay = delays[Math.min(attempt, delays.length - 1)];
    if (now() + delay > deadline) return failure ? { kind: 'error', ...failure } : { kind: 'timeout' };
    try {
      await sleep(delay, signal);
    } catch {
      return { kind: 'aborted' };
    }
  }
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function readContractField(value: unknown): ContractField | null {
  if (!isRecord(value) || typeof value.status !== 'string' || !('value' in value)) return null;
  const review = Array.isArray(value.review) ? value.review.filter((item): item is string => typeof item === 'string') : [];
  return { value: value.value, status: value.status, source: typeof value.source === 'string' ? value.source : null, review };
}

const ABSENT = { value: null, status: 'absent', source: null } as const;
const PENDING = { value: null, status: 'unavailable', source: null } as const;

function textField(field: ContractField): PrefillField<string> {
  if (field.status === 'lookup_pending') return { ...PENDING };
  if (typeof field.value !== 'string' || !field.value.trim()) return { ...ABSENT };
  return { value: field.value, status: field.status === 'needs_review' ? 'needs_review' : 'present', source: field.source };
}

function countryField(field: ContractField): PrefillField<FeeCountry> {
  if (field.value === 'EW' || field.value === 'J' || field.value === 'OTHER') {
    return { value: field.value, status: 'present', source: field.source };
  }
  return { ...ABSENT };
}

function addressField(field: ContractField): PrefillField<string[]> {
  if (field.status === 'lookup_pending') return { ...PENDING };
  if (!Array.isArray(field.value) || field.value.some((line) => typeof line !== 'string')) return { ...ABSENT };
  const lines = field.value as string[];
  if (!lines.some((line) => line.trim())) return { ...ABSENT };
  if (field.status === 'needs_review') {
    const homeSlot = field.review.includes('home_slot_on_company_record');
    return { value: lines, status: 'needs_review', source: homeSlot ? 'company_address_home' : field.source };
  }
  return { value: lines, status: 'present', source: field.source };
}

function verifiedField<T extends number | boolean>(field: ContractField, kind: 'number' | 'boolean'): PrefillField<T> {
  if (field.status !== 'verified' || typeof field.value !== kind) return { ...ABSENT };
  return { value: field.value as T, status: 'present', source: field.source };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
