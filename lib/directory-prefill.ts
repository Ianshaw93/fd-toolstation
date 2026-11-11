// Polling and notices around GET /v1/projects/{id}/fee-proposal-prefill (contractVersion 1,
// fd-project-directory docs/api.md and docs/fee-proposal-prefill.md). Merging into the form is
// the shared client's applyFeeProposalPrefill; this file only decides when to ask again and what
// to tell the user. The worker fetches the Client role after the first request, so the pane asks
// again with backoff while client.lookup is "pending" and gives up to manual entry.

import { DirectoryError, type DirectoryErrorCode, type FeeProposalPrefill } from './vendor/fd-directory-client';

export const CLIENT_LOOKUP_PENDING_NOTICE =
  'Looking up the Client role for this project. Company and address fill in when it finishes; anything you type is kept.';
export const CLIENT_LOOKUP_TIMEOUT_NOTICE =
  'The Client lookup is still running. Fill in the company, name, and address by hand, or choose the project again later.';

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

export function isFeeProposalPrefillV1(body: unknown): body is FeeProposalPrefill {
  if (!isRecord(body) || body.contractVersion !== 1) return false;
  if (!isRecord(body.project) || typeof body.project.id !== 'string') return false;
  if (!isRecord(body.client) || !['pending', 'done', 'failed'].includes(body.client.lookup as string)) return false;
  const fields = body.fields;
  if (!isRecord(fields)) return false;
  return FIELD_KEYS.every((key) => isRecord(fields[key]) && typeof fields[key].status === 'string' && 'value' in fields[key]);
}

export function prefillNotice(prefill: FeeProposalPrefill): string | null {
  const { client } = prefill;
  if (client.lookup === 'pending') return CLIENT_LOOKUP_PENDING_NOTICE;
  if (client.lookup === 'failed') {
    return `The Client lookup failed${client.errorCode ? ` (${client.errorCode})` : ''}. Fill in the company, name, and address by hand.`;
  }
  switch (client.status) {
    case 'found':
      // Review reasons are shown on the address field itself (field-provenance).
      return null;
    case 'no_client_role':
      return 'This project has no Client role in Synergy. Fill in the company, name, and address by hand.';
    case 'multiple_client_roles': {
      const names = client.candidates.map((candidate) => candidate.name).filter(Boolean).join(', ');
      return `This project has more than one Client in Synergy${names ? ` (${names})` : ''}. None was chosen; fill in the client by hand.`;
    }
    case 'contact_detail_missing':
    case 'invalid_response':
      return 'The Client contact could not be read from Synergy. Fill in the company, name, and address by hand.';
    default:
      return null;
  }
}

export type PollOutcome =
  | { kind: 'done' }
  | { kind: 'timeout' }
  | { kind: 'aborted' }
  | { kind: 'not_found' }
  | { kind: 'contract_mismatch' }
  | { kind: 'error'; code: DirectoryErrorCode };

export const POLL_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000];
// The directory worker usually serves a lookup within one interval; give it about six minutes.
export const POLL_TIMEOUT_MS = 6 * 60_000;

const RETRYABLE = new Set<DirectoryErrorCode>(['network_error', 'http_error']);

export interface PollOptions {
  fetchPrefill: (ref: string, signal: AbortSignal) => Promise<FeeProposalPrefill | null>;
  signal: AbortSignal;
  onResponse: (prefill: FeeProposalPrefill) => void;
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
    let body: FeeProposalPrefill | null = null;
    let failure: DirectoryErrorCode | null = null;
    try {
      body = await options.fetchPrefill(ref, signal);
    } catch (error) {
      if (signal.aborted) return { kind: 'aborted' };
      failure = error instanceof DirectoryError ? error.code : 'network_error';
      if (!RETRYABLE.has(failure)) return { kind: 'error', code: failure };
    }
    if (signal.aborted) return { kind: 'aborted' };

    if (!failure) {
      if (body === null) return { kind: 'not_found' };
      if (!isFeeProposalPrefillV1(body) || body.project.id !== ref) return { kind: 'contract_mismatch' };
      options.onResponse(body);
      if (body.client.lookup !== 'pending') return { kind: 'done' };
    }

    const delay = delays[Math.min(attempt, delays.length - 1)];
    if (now() + delay > deadline) return failure ? { kind: 'error', code: failure } : { kind: 'timeout' };
    try {
      await sleep(delay, signal);
    } catch {
      return { kind: 'aborted' };
    }
  }
}

export function outcomeNotice(outcome: PollOutcome): string | null {
  switch (outcome.kind) {
    case 'timeout':
      return CLIENT_LOOKUP_TIMEOUT_NOTICE;
    case 'not_found':
      return 'The project directory does not know this project. Fill in the details by hand.';
    case 'contract_mismatch':
      return 'The project directory answered in a format this pane does not read. Fill in the client details by hand.';
    case 'error':
      return errorNotice(outcome.code);
    default:
      return null;
  }
}

export function errorNotice(code: DirectoryErrorCode): string {
  switch (code) {
    case 'interaction_required':
    case 'no_access_token':
    case 'unauthorized':
      return 'Sign in with Microsoft to use the project directory. Fill in details by hand meanwhile.';
    case 'not_an_access_token':
    case 'wrong_audience':
      return 'The Microsoft sign-in did not give a project directory token. Fill in details by hand.';
    case 'forbidden':
      return 'Your account cannot use the project directory. Fill in details by hand.';
    case 'not_configured':
      return 'The project directory is not configured yet. Fill in details by hand.';
    default:
      return 'The project directory could not be reached. Fill in details by hand.';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
