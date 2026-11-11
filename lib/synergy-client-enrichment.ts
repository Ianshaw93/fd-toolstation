// Typed seam for fee-letter autofill.
//
// Official GetProjectById for project 2694397 (0406) returned primaryContactName
// and an empty site address, and no contact-role assignment. Organisation role
// Client is 183340. Client Project Manager is 206928 and is not the Client role.
// The documented v4 OpenAPI has no GET for project contacts or a contact address.
// primaryContact and site are never copied into the letter. An explicit Client-role
// record is the only shape that fills company, person, or company address.

export const SYNERGY_CLIENT_ROLE_ID = 183340;
export const SYNERGY_CLIENT_PROJECT_MANAGER_ROLE_ID = 206928;

export const CLIENT_ROLE_SOURCE_NOTICE =
  'The documented project read has no Client-role contact or address. The primary contact was not used. Company, name, and address stay as you left them.';

export type FeeCountry = 'EW' | 'J' | 'OTHER';

export interface SynergyContactName {
  first_name: string;
  surname: string;
}

export interface SynergyClientRole {
  role: 'Client';
  company_name: string | null;
  address_lines: string[];
  contact: SynergyContactName | null;
}

export interface SynergyFeeEnrichment {
  organisation_id: number;
  synergy_project_id: number;
  label: string;
  project_name: string | null;
  project_location: string | null;
  country: FeeCountry | null;
  client_roles: SynergyClientRole[];
  engineer_name: string | null;
  pii_limit: number | null;
  include_hourly_rates: boolean | null;
}

export interface FeeAutofillMemory {
  company_name?: string;
  first_name?: string;
  surname?: string;
  address_lines?: string[];
  project_name?: string;
  project_location?: string;
  country?: FeeCountry;
  engineer_name?: string;
  pii_limit?: number;
  include_hourly_rates?: boolean;
}

export interface FeeAutofillState {
  company_name: string;
  first_name: string;
  surname: string;
  address_lines: string[];
  project_name: string;
  project_location: string;
  country: FeeCountry;
  country_touched: boolean;
  engineer_name: string;
  pii_limit: number;
  include_hourly_rates: boolean;
  autofill: FeeAutofillMemory | null;
  notice?: string | null;
}

export type EnrichmentParse =
  | { ok: true; enrichment: SynergyFeeEnrichment }
  | { ok: false; reason: 'contract_missing' };

export type OfficialProjectClientRead =
  | { status: 'unavailable'; reason: 'no_client_role_assignment'; project_name: string | null }
  | { status: 'rejected'; reason: 'not_a_project_read' };

/** Official project GET. Reads the project name only. Does not read primaryContact or site. */
export function readOfficialProjectClient(payload: unknown): OfficialProjectClientRead {
  if (!isRecord(payload)) return { status: 'rejected', reason: 'not_a_project_read' };
  const looksOfficial =
    'primaryContactName' in payload ||
    'primaryContactId' in payload ||
    'site' in payload ||
    'numberFormatted' in payload;
  if (!looksOfficial || Array.isArray(payload.client_roles)) {
    return { status: 'rejected', reason: 'not_a_project_read' };
  }
  const project_name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : null;
  return { status: 'unavailable', reason: 'no_client_role_assignment', project_name };
}

/**
 * The project read did not include a Client role. Keep typed values.
 * Clear only client fields that still match the previous autofill, so they
 * are not left attached to the newly selected project.
 */
export function applyMissingClientSource(
  state: FeeAutofillState,
  source: { project_name: string | null; project_location: string | null },
): FeeAutofillState & { notice: string } {
  const memory: FeeAutofillMemory = { ...(state.autofill ?? {}) };
  const next: FeeAutofillState & { notice: string } = {
    ...state,
    address_lines: [...state.address_lines],
    autofill: memory,
    notice: CLIENT_ROLE_SOURCE_NOTICE,
  };
  const clientBefore = clientSnapshot(state);
  writeText(next, memory, 'project_name', source.project_name);
  writeText(next, memory, 'project_location', source.project_location);
  clearClientIfAutofilled(next, memory);
  if (clientSnapshot(next) !== clientBefore) {
    next.notice =
      'The documented project read has no Client-role contact or address. The primary contact was not used. Client details filled from an earlier project were cleared. Values you typed yourself are unchanged.';
  }
  next.autofill = memory;
  return next;
}

function clientSnapshot(state: FeeAutofillState): string {
  return JSON.stringify([state.company_name, state.first_name, state.surname, state.address_lines]);
}

const COUNTRIES = new Set<FeeCountry>(['EW', 'J', 'OTHER']);

export function parseFeeEnrichment(payload: unknown): EnrichmentParse {
  if (!isRecord(payload) || !Array.isArray(payload.client_roles)) {
    return { ok: false, reason: 'contract_missing' };
  }
  if (!isNumber(payload.organisation_id) || !isNumber(payload.synergy_project_id)) {
    return { ok: false, reason: 'contract_missing' };
  }
  if (typeof payload.label !== 'string') return { ok: false, reason: 'contract_missing' };
  const country = payload.country;
  if (!(country === null || country === undefined || (typeof country === 'string' && COUNTRIES.has(country as FeeCountry)))) {
    return { ok: false, reason: 'contract_missing' };
  }
  if (!isOptionalText(payload.project_name) || !isOptionalText(payload.project_location)) {
    return { ok: false, reason: 'contract_missing' };
  }
  if (!isOptionalText(payload.engineer_name)) return { ok: false, reason: 'contract_missing' };
  if (!isOptionalNumber(payload.pii_limit)) return { ok: false, reason: 'contract_missing' };
  if (!isOptionalBoolean(payload.include_hourly_rates)) return { ok: false, reason: 'contract_missing' };

  const client_roles: SynergyClientRole[] = [];
  for (const row of payload.client_roles) {
    const role = parseClientRole(row);
    if (role) client_roles.push(role);
  }

  return {
    ok: true,
    enrichment: {
      organisation_id: payload.organisation_id,
      synergy_project_id: payload.synergy_project_id,
      label: payload.label,
      project_name: textOrNull(payload.project_name),
      project_location: textOrNull(payload.project_location),
      country: typeof country === 'string' ? (country as FeeCountry) : null,
      client_roles,
      engineer_name: textOrNull(payload.engineer_name),
      pii_limit: typeof payload.pii_limit === 'number' ? payload.pii_limit : null,
      include_hourly_rates: typeof payload.include_hourly_rates === 'boolean' ? payload.include_hourly_rates : null,
    },
  };
}

export function applySynergyEnrichment(
  state: FeeAutofillState,
  enrichment: SynergyFeeEnrichment,
  engineerNames: readonly string[],
  race?: { generation: number; currentGeneration: number },
): FeeAutofillState & { notice: string | null } {
  if (race && race.generation !== race.currentGeneration) {
    return state as FeeAutofillState & { notice: string | null };
  }

  const memory: FeeAutofillMemory = { ...(state.autofill ?? {}) };
  const next: FeeAutofillState & { notice: string | null } = {
    ...state,
    address_lines: [...state.address_lines],
    notice: null,
    autofill: memory,
  };

  writeText(next, memory, 'project_name', enrichment.project_name);
  writeText(next, memory, 'project_location', enrichment.project_location);
  if (enrichment.country && (state.autofill?.country === state.country || !state.country_touched)) {
    next.country = enrichment.country;
    memory.country = enrichment.country;
  }

  const clients = enrichment.client_roles.filter((role) => role.role === 'Client');
  if (clients.length !== 1) {
    clearClientIfAutofilled(next, memory);
    next.notice = clients.length === 0
      ? 'No Client role was on this project. Company and contact were left blank.'
      : 'This project has more than one Client role. None was chosen.';
  } else {
    const client = clients[0];
    writeText(next, memory, 'company_name', client.company_name);
    writeText(next, memory, 'first_name', client.contact?.first_name ?? null);
    writeText(next, memory, 'surname', client.contact?.surname ?? null);
    if (canReplaceLines(next.address_lines, memory.address_lines)) {
      const lines = padAddress(client.address_lines);
      next.address_lines = lines;
      memory.address_lines = lines;
    }
  }

  if (
    enrichment.engineer_name &&
    engineerNames.includes(enrichment.engineer_name) &&
    canReplace(next.engineer_name, memory.engineer_name)
  ) {
    next.engineer_name = enrichment.engineer_name;
    memory.engineer_name = enrichment.engineer_name;
  }
  if (
    enrichment.pii_limit !== null &&
    canReplaceNumber(next.pii_limit, memory.pii_limit, 100000)
  ) {
    next.pii_limit = enrichment.pii_limit;
    memory.pii_limit = enrichment.pii_limit;
  }
  if (
    enrichment.include_hourly_rates !== null &&
    canReplaceBoolean(next.include_hourly_rates, memory.include_hourly_rates, false)
  ) {
    next.include_hourly_rates = enrichment.include_hourly_rates;
    memory.include_hourly_rates = enrichment.include_hourly_rates;
  }

  next.autofill = memory;
  return next;
}

function writeText(
  next: FeeAutofillState,
  memory: FeeAutofillMemory,
  field: 'project_name' | 'project_location' | 'company_name' | 'first_name' | 'surname',
  value: string | null,
): void {
  if (!value || !value.trim()) return;
  if (!canReplace(next[field], memory[field])) return;
  next[field] = value.trim();
  memory[field] = value.trim();
}

function clearClientIfAutofilled(next: FeeAutofillState, memory: FeeAutofillMemory): void {
  if (canReplace(next.company_name, memory.company_name)) next.company_name = '';
  if (canReplace(next.first_name, memory.first_name)) next.first_name = '';
  if (canReplace(next.surname, memory.surname)) next.surname = '';
  if (canReplaceLines(next.address_lines, memory.address_lines)) {
    next.address_lines = padAddress([]);
  }
  delete memory.company_name;
  delete memory.first_name;
  delete memory.surname;
  delete memory.address_lines;
}

function canReplace(current: string, previous: string | undefined): boolean {
  if (!current.trim()) return true;
  return previous !== undefined && current.trim() === previous.trim();
}

function canReplaceLines(current: string[], previous: string[] | undefined): boolean {
  const filled = current.map((line) => line.trim()).filter(Boolean);
  if (filled.length === 0) return true;
  if (!previous) return false;
  return filled.join('\n') === previous.map((line) => line.trim()).filter(Boolean).join('\n');
}

function canReplaceNumber(current: number, previous: number | undefined, fallback: number): boolean {
  if (previous !== undefined && current === previous) return true;
  return previous === undefined && current === fallback;
}

function canReplaceBoolean(current: boolean, previous: boolean | undefined, fallback: boolean): boolean {
  if (previous !== undefined && current === previous) return true;
  return previous === undefined && current === fallback;
}

function padAddress(lines: string[]): string[] {
  const kept = lines.map((line) => line.trim()).filter(Boolean).slice(0, 6);
  while (kept.length < 6) kept.push('');
  return kept;
}

function parseClientRole(row: unknown): SynergyClientRole | null {
  if (!isRecord(row) || typeof row.role !== 'string') return null;
  if (typeof row.role_id === 'number' && row.role_id !== SYNERGY_CLIENT_ROLE_ID) return null;
  if (row.role.trim().toLowerCase() !== 'client') return null;
  const address_lines = Array.isArray(row.address_lines)
    ? row.address_lines.filter((line): line is string => typeof line === 'string')
    : [];
  return {
    role: 'Client',
    company_name: typeof row.company_name === 'string' ? row.company_name : null,
    address_lines,
    contact: parseContact(row.contact),
  };
}

function parseContact(value: unknown): SynergyContactName | null {
  if (!isRecord(value)) return null;
  const first_name = typeof value.first_name === 'string' ? value.first_name : '';
  const surname = typeof value.surname === 'string' ? value.surname : '';
  if (!first_name.trim() && !surname.trim()) return null;
  return { first_name, surname };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'number' && !Number.isNaN(value));
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'boolean';
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
