// Typed seam for fee-letter autofill.
//
// Official V2 documents ProjectContacts/Index and Contacts/GetContact
// (https://app.totalsynergy.com/swagger/docs/V2). Role Client is 183340.
// Client Project Manager is 206928 and is not that role. A GetProjectById
// primaryContact string is not a role assignment. For a type 20 company, a
// street-bearing addressHome is used only when postal, work, and other have
// no street, and it is marked needs review. A person's addressHome is not used.
// The company name is never written into the salutation. Project country is
// not inferred from the address country.

export const SYNERGY_CLIENT_ROLE_ID = 183340;
export const SYNERGY_CLIENT_PROJECT_MANAGER_ROLE_ID = 206928;

export const CLIENT_ROLE_SOURCE_NOTICE =
  'This project record has no Client-role assignment. The primary contact was not used. Company, name, and address stay as you left them.';

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
      'This project record has no Client-role assignment. The primary contact was not used. Client details filled from an earlier project were cleared. Values you typed yourself are unchanged.';
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

export type PrefillStatus = 'present' | 'absent' | 'needs_review' | 'unavailable';

export interface PrefillField<T> {
  value: T | null;
  status: PrefillStatus;
  source: string | null;
}

export interface FeeProposalPrefill {
  company_name: PrefillField<string>;
  first_name: PrefillField<string>;
  surname: PrefillField<string>;
  address_lines: PrefillField<string[]>;
  project_name: PrefillField<string>;
  project_location: PrefillField<string>;
  country: PrefillField<FeeCountry>;
  engineer_name: PrefillField<string>;
  pii_limit: PrefillField<number>;
  include_hourly_rates: PrefillField<boolean>;
}

export const COMPANY_ADDRESS_HOME_NOTICE =
  'Company address was taken from the company addressHome slot and needs review.';

const PREFILL_STATUSES = new Set<PrefillStatus>(['present', 'absent', 'needs_review', 'unavailable']);

export function feeProposalPrefillFromV2(payload: {
  projectId: number;
  roleId: number;
  assignments: unknown[];
}): FeeProposalPrefill {
  const clients = payload.assignments.filter((row) => {
    if (!isRecord(row)) return false;
    return row.roleId === payload.roleId && payload.roleId === SYNERGY_CLIENT_ROLE_ID;
  });
  const prefill = emptyPrefill();
  if (clients.length !== 1) return prefill;
  const assignment = clients[0];
  if (!isRecord(assignment) || !isRecord(assignment.contact)) return prefill;
  const contact = assignment.contact;
  const typeId = contact.contactTypeId;
  if (typeId === 20 && typeof contact.name === 'string' && contact.name.trim()) {
    prefill.company_name = { value: contact.name, status: 'present', source: 'client_role' };
  }
  if (typeId === 21 || typeId === 31) {
    const first = typeof contact.firstName === 'string' ? contact.firstName.trim() : '';
    const last = typeof contact.lastName === 'string' ? contact.lastName.trim() : '';
    if (first) prefill.first_name = { value: first, status: 'present', source: 'client_role' };
    if (last) prefill.surname = { value: last, status: 'present', source: 'client_role' };
  }
  const address = companyAddress(contact);
  if (address) {
    prefill.address_lines = {
      value: padAddress(address.lines),
      status: address.needsReview ? 'needs_review' : 'present',
      source: address.source,
    };
  }
  return prefill;
}

export function parseDirectoryPrefill(payload: unknown):
  | { ok: true; prefill: FeeProposalPrefill }
  | { ok: false; reason: 'contract_missing' } {
  if (!isRecord(payload)) return { ok: false, reason: 'contract_missing' };
  const company_name = readField<string>(payload.company_name, 'string');
  const first_name = readField<string>(payload.first_name, 'string');
  const surname = readField<string>(payload.surname, 'string');
  const project_name = readField<string>(payload.project_name, 'string');
  const project_location = readField<string>(payload.project_location, 'string');
  const engineer_name = readField<string>(payload.engineer_name, 'string');
  const pii_limit = readField<number>(payload.pii_limit, 'number');
  const include_hourly_rates = readField<boolean>(payload.include_hourly_rates, 'boolean');
  const country = readCountryField(payload.country);
  const address_lines = readAddressField(payload.address_lines);
  if (!company_name || !first_name || !surname || !project_name || !project_location || !engineer_name || !pii_limit || !include_hourly_rates || !country || !address_lines) {
    return { ok: false, reason: 'contract_missing' };
  }
  return {
    ok: true,
    prefill: {
      company_name,
      first_name,
      surname,
      address_lines,
      project_name,
      project_location,
      country,
      engineer_name,
      pii_limit,
      include_hourly_rates,
    },
  };
}

export function applyFeeProposalPrefill(
  state: FeeAutofillState,
  prefill: FeeProposalPrefill,
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
    autofill: memory,
    notice: null,
  };
  writePrefillText(next, memory, 'company_name', prefill.company_name);
  writePrefillText(next, memory, 'first_name', prefill.first_name);
  writePrefillText(next, memory, 'surname', prefill.surname);
  writePrefillText(next, memory, 'project_name', prefill.project_name);
  writePrefillText(next, memory, 'project_location', prefill.project_location);
  if (
    prefill.address_lines.status === 'present' ||
    prefill.address_lines.status === 'needs_review'
  ) {
    const lines = prefill.address_lines.value;
    if (lines && canReplaceLines(next.address_lines, memory.address_lines)) {
      const padded = padAddress(lines.filter((line) => line !== ''));
      next.address_lines = padded;
      memory.address_lines = padded;
    }
  }
  if (
    prefill.country.status === 'present' &&
    prefill.country.value &&
    (state.autofill?.country === state.country || !state.country_touched)
  ) {
    next.country = prefill.country.value;
    memory.country = prefill.country.value;
  }
  if (
    prefill.engineer_name.status === 'present' &&
    prefill.engineer_name.value &&
    engineerNames.includes(prefill.engineer_name.value) &&
    canReplace(next.engineer_name, memory.engineer_name)
  ) {
    next.engineer_name = prefill.engineer_name.value;
    memory.engineer_name = prefill.engineer_name.value;
  }
  if (
    prefill.pii_limit.status === 'present' &&
    typeof prefill.pii_limit.value === 'number' &&
    canReplaceNumber(next.pii_limit, memory.pii_limit, 100000)
  ) {
    next.pii_limit = prefill.pii_limit.value;
    memory.pii_limit = prefill.pii_limit.value;
  }
  if (
    prefill.include_hourly_rates.status === 'present' &&
    typeof prefill.include_hourly_rates.value === 'boolean' &&
    canReplaceBoolean(next.include_hourly_rates, memory.include_hourly_rates, false)
  ) {
    next.include_hourly_rates = prefill.include_hourly_rates.value;
    memory.include_hourly_rates = prefill.include_hourly_rates.value;
  }
  if (prefill.address_lines.status === 'needs_review' && prefill.address_lines.source === 'company_address_home') {
    const applied = next.address_lines.some((line) => line !== '') &&
      memory.address_lines?.join('\n') === next.address_lines.join('\n');
    if (applied) next.notice = COMPANY_ADDRESS_HOME_NOTICE;
  }
  next.autofill = memory;
  return next;
}

function writePrefillText(
  next: FeeAutofillState,
  memory: FeeAutofillMemory,
  field: 'company_name' | 'first_name' | 'surname' | 'project_name' | 'project_location',
  source: PrefillField<string>,
): void {
  if (source.status !== 'present' && source.status !== 'needs_review') return;
  writeText(next, memory, field, source.value);
}

function emptyPrefill(): FeeProposalPrefill {
  const absent = <T,>(): PrefillField<T> => ({ value: null, status: 'absent', source: null });
  return {
    company_name: absent(),
    first_name: absent(),
    surname: absent(),
    address_lines: absent(),
    project_name: absent(),
    project_location: absent(),
    country: absent(),
    engineer_name: absent(),
    pii_limit: absent(),
    include_hourly_rates: absent(),
  };
}

function companyAddress(contact: Record<string, unknown>): { lines: string[]; needsReview: boolean; source: string } | null {
  if (contact.contactTypeId !== 20) return null;
  for (const slot of ['addressPostal', 'addressWork', 'addressOther'] as const) {
    const lines = streetLines(contact[slot]);
    if (lines) return { lines, needsReview: false, source: slot };
  }
  const home = streetLines(contact.addressHome);
  if (home) return { lines: home, needsReview: true, source: 'company_address_home' };
  return null;
}

function streetLines(value: unknown): string[] | null {
  if (!isRecord(value)) return null;
  const street = [value.address1, value.address2, value.town].some((part) => typeof part === 'string' && part.trim() !== '');
  if (!street) return null;
  return compactAddress(value);
}

function compactAddress(value: Record<string, unknown>): string[] {
  const parts = [value.address1, value.address2, value.town, value.state, value.zipCode, value.country];
  return parts.filter((part): part is string => typeof part === 'string' && part.trim() !== '').slice(0, 6);
}

function readField<T>(value: unknown, kind: 'string' | 'number' | 'boolean'): PrefillField<T> | null {
  if (!isRecord(value) || typeof value.status !== 'string' || !PREFILL_STATUSES.has(value.status as PrefillStatus)) return null;
  const status = value.status as PrefillStatus;
  const source = typeof value.source === 'string' ? value.source : null;
  if (value.value === null || value.value === undefined) return { value: null, status, source };
  if (kind === 'string' && typeof value.value === 'string') return { value: value.value as T, status, source };
  if (kind === 'number' && typeof value.value === 'number') return { value: value.value as T, status, source };
  if (kind === 'boolean' && typeof value.value === 'boolean') return { value: value.value as T, status, source };
  return null;
}

function readCountryField(value: unknown): PrefillField<FeeCountry> | null {
  const field = readField<string>(value, 'string');
  if (!field) return null;
  if (field.value === null) return { value: null, status: field.status, source: field.source };
  if (field.value === 'EW' || field.value === 'J' || field.value === 'OTHER') {
    return { value: field.value, status: field.status, source: field.source };
  }
  return null;
}

function readAddressField(value: unknown): PrefillField<string[]> | null {
  if (!isRecord(value) || typeof value.status !== 'string' || !PREFILL_STATUSES.has(value.status as PrefillStatus)) return null;
  const status = value.status as PrefillStatus;
  const source = typeof value.source === 'string' ? value.source : null;
  if (value.value === null || value.value === undefined) return { value: null, status, source };
  if (!Array.isArray(value.value) || value.value.some((line) => typeof line !== 'string')) return null;
  return { value: value.value, status, source };
}
