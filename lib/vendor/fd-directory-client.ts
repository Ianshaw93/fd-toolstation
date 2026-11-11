// Vendored verbatim from Fire-Dynamics-Group/fd-project-directory src/client/index.ts at
// 63b3d4835ee217980334a487f4928e84d4e9aef6 (PR #2). Do not edit here; update from that source.

// FD Project Directory client for apps that already sign users in with the shared FD Microsoft
// registration (Upload Canvas, backendForNextApp, email-search add-in). Self-contained: no imports,
// so it can be vendored as one file. Search/select/resolve only; no UI, no Graph.

export const FD_SHARED_CLIENT_ID = "2b180b8a-7cd3-40b2-83dd-8338103ce41e";
export const FD_DIRECTORY_SCOPE = `api://${FD_SHARED_CLIENT_ID}/access_as_user`;

const GRAPH_AUDIENCES = new Set(["00000003-0000-0000-c000-000000000000", "https://graph.microsoft.com"]);

export type DirectoryErrorCode =
  | "insecure_base_url"
  | "interaction_required"
  | "no_access_token"
  | "not_an_access_token"
  | "wrong_audience"
  | "unauthorized"
  | "forbidden"
  | "not_configured"
  | "bad_request"
  | "http_error"
  | "network_error";

export class DirectoryError extends Error {
  readonly code: DirectoryErrorCode;
  readonly status: number | undefined;
  constructor(code: DirectoryErrorCode, status?: number) {
    super(code);
    this.name = "DirectoryError";
    this.code = code;
    this.status = status;
  }
}

export interface DirectoryRef {
  id: string | null;
  name: string | null;
}

export interface DirectoryProject {
  id: string;
  organisationId: number;
  synergyProjectId: number;
  /** Exactly `${numberFormatted} ${name}`. Display verbatim. */
  label: string;
  numberFormatted: string | null;
  projectNumber: string | null;
  name: string | null;
  status: { name: string | null; id: string | null; typeId: string | null };
  isActive: boolean | null;
  isArchived: boolean;
  manager: DirectoryRef | null;
  primaryContact: DirectoryRef | null;
  office: DirectoryRef | null;
  projectType: DirectoryRef | null;
  tags: string[];
  sourceUpdatedAt: string | null;
  syncedAt: string;
  missingSince: string | null;
}

export interface SearchResult {
  items: DirectoryProject[];
  page: { limit: number; offset: number; nextOffset: number | null; total: number };
  meta: { lastSuccessfulSyncAt: string | null; stale: boolean };
}

/** What an app stores on its own work item. `ref` is the stable key; `label` is a display snapshot. */
export interface ProjectRef {
  ref: string;
  organisationId: number;
  synergyProjectId: number;
  label: string;
  capturedAt: string;
}

export type ResolveStatus = "active" | "inactive" | "archived" | "missing" | "not_found";

export type PrefillFieldStatus =
  | "from_synergy"
  | "needs_review"
  | "missing"
  | "unrecognised"
  | "not_in_source"
  | "manual_only"
  | "unverified_contact_type"
  | "lookup_pending"
  | "lookup_failed"
  | "no_client_role"
  | "multiple_client_roles"
  | "contact_detail_missing"
  | "invalid_response";

/**
 * `value` is non-null only for "from_synergy" and "needs_review". "needs_review" means the value is
 * real Synergy data from a questionable slot; `review` says why. `source` names the Synergy field.
 */
export interface PrefillField<T> {
  value: T | null;
  status: PrefillFieldStatus;
  source: string | null;
  review?: Array<"hasAddress_false" | "home_slot_on_company_record">;
}

/** GET /v1/projects/{ref}/fee-proposal-prefill (contract version 1). */
export interface FeeProposalPrefill {
  contractVersion: 1;
  project: { id: string; label: string; isActive: boolean | null; missingSince: string | null };
  source: { system: "total-synergy"; record: "Projects/Index"; sourceUpdatedAt: string | null; syncedAt: string; stale: boolean };
  fields: {
    projectName: PrefillField<string>;
    projectLocation: PrefillField<string>;
    projectCountry: PrefillField<"EW" | "J" | "OTHER"> & { sourceValue: string | null };
    engineerName: PrefillField<string>;
    clientFirstName: PrefillField<string>;
    clientSurname: PrefillField<string>;
    clientCompanyName: PrefillField<string>;
    clientAddressLines: PrefillField<string[]>;
    piiLimit: PrefillField<number>;
    includeHourlyRates: PrefillField<boolean>;
  };
  /** The project's site address. Context only: never the client's address. */
  siteAddress: { lines: string[]; town: string | null; state: string | null; postcode: string | null; country: string | null } | null;
  /** Synergy's project manager. Context only: not verified as the proposal's engineer. */
  projectManager: { synergyManagerId: string | null; name: string; verifiedAsEngineer: false } | null;
  /**
   * The project contact holding the Client role. The directory's sync worker fetches it after the
   * first request ("pending"), usually within one worker interval; ask again to pick it up.
   */
  client: {
    lookup: "pending" | "done" | "failed";
    fetchedAt: string | null;
    errorCode: string | null;
    status: "found" | "no_client_role" | "multiple_client_roles" | "contact_detail_missing" | "invalid_response" | null;
    projectContactId: number | null;
    contactId: number | null;
    displayName: string | null;
    candidates: Array<{ projectContactId: number | null; contactId: number | null; name: string | null }>;
  };
}

/** The form fields a prefill may set. Engineer, location, PII limit and hourly rates are never touched. */
export interface PrefillTarget {
  projectName: string;
  projectCountry: string;
  clientFirstName: string;
  clientSurname: string;
  clientCompanyName: string;
  clientAddressLines: string[];
}

type PrefillKey = keyof PrefillTarget;
/** Why a field was left alone: its prefill status, no prefill at all, or a response for another project. */
export type PrefillSkipReason = PrefillFieldStatus | "no_prefill" | "stale_response";
const PREFILL_KEYS: readonly PrefillKey[] = ["projectName", "projectCountry", "clientFirstName", "clientSurname", "clientCompanyName", "clientAddressLines"];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Merges a prefill into the form without overwriting the user's own input. A field counts as the
 * user's when it differs from what this helper last applied (`previouslyApplied`) or, if it never
 * applied one, from the form default. On a project switch, values applied for the previous project
 * are replaced, or reset to the default when the new project has no value. Store `applied` and pass
 * it back as `previouslyApplied` next time. Pass `selectedRef` (the project selected now) so a late
 * response for an earlier selection changes nothing.
 */
export function applyFeeProposalPrefill(args: {
  current: PrefillTarget;
  defaults: PrefillTarget;
  prefill: FeeProposalPrefill | null;
  previouslyApplied?: Partial<PrefillTarget>;
  selectedRef?: string | Pick<ProjectRef, "ref">;
}): {
  values: PrefillTarget;
  applied: Partial<PrefillTarget>;
  kept: PrefillKey[];
  skipped: Array<{ field: PrefillKey; reason: PrefillSkipReason }>;
  needsReview: Array<{ field: PrefillKey; review: NonNullable<PrefillField<unknown>["review"]> }>;
} {
  const { current, defaults, prefill, previouslyApplied = {}, selectedRef } = args;
  const selected = typeof selectedRef === "string" ? selectedRef : selectedRef?.ref;
  if (prefill && selected !== undefined && prefill.project.id !== selected) {
    return {
      values: { ...current },
      applied: { ...previouslyApplied },
      kept: [],
      skipped: PREFILL_KEYS.map((field) => ({ field, reason: "stale_response" as const })),
      needsReview: [],
    };
  }
  const values = {} as Record<PrefillKey, unknown>;
  const applied: Partial<Record<PrefillKey, unknown>> = {};
  const kept: PrefillKey[] = [];
  const skipped: Array<{ field: PrefillKey; reason: PrefillSkipReason }> = [];
  const needsReview: Array<{ field: PrefillKey; review: NonNullable<PrefillField<unknown>["review"]> }> = [];

  for (const key of PREFILL_KEYS) {
    const baseline = key in previouslyApplied ? previouslyApplied[key] : defaults[key];
    if (!same(current[key], baseline)) {
      values[key] = current[key];
      kept.push(key);
      continue;
    }
    const f = prefill?.fields[key] as PrefillField<string | string[]> | undefined;
    let candidate: unknown = f?.status === "from_synergy" || f?.status === "needs_review" ? f.value : null;
    if (Array.isArray(candidate)) {
      const width = defaults.clientAddressLines.length;
      candidate = [...candidate, ...Array<string>(Math.max(0, width - candidate.length)).fill("")].slice(0, Math.max(width, candidate.length));
    }
    if (candidate !== null && candidate !== undefined) {
      values[key] = candidate;
      applied[key] = candidate;
      if (f?.status === "needs_review") needsReview.push({ field: key, review: f.review ?? [] });
    } else {
      values[key] = defaults[key];
      skipped.push({ field: key, reason: f?.status ?? "no_prefill" });
    }
  }
  return { values: values as unknown as PrefillTarget, applied: applied as Partial<PrefillTarget>, kept, skipped, needsReview };
}

export interface SearchOptions {
  includeInactive?: boolean;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

/**
 * Token provider backed by the app's existing MSAL instance and signed-in account. Always returns
 * the access token for the directory scope, never the ID token. When MSAL needs interaction it
 * throws `interaction_required`, and the app's existing sign-in flow should handle it.
 */
export function msalAccessTokenProvider(
  msal: { acquireTokenSilent(request: { scopes: string[]; account: never }): Promise<{ accessToken?: string }> },
  getAccount: () => unknown,
  scope: string = FD_DIRECTORY_SCOPE,
): () => Promise<string> {
  return async () => {
    let result: { accessToken?: string };
    try {
      result = await msal.acquireTokenSilent({ scopes: [scope], account: getAccount() as never });
    } catch (err) {
      const e = err as { name?: string; errorCode?: string } | null;
      const interaction =
        e?.name === "InteractionRequiredAuthError" ||
        ["interaction_required", "login_required", "consent_required", "no_account_error"].includes(e?.errorCode ?? "");
      throw new DirectoryError(interaction ? "interaction_required" : "no_access_token");
    }
    if (!result?.accessToken) throw new DirectoryError("no_access_token");
    return result.accessToken;
  };
}

function decodePayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const binary = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Local guard against the two common misconfigurations (sending the ID token, or a Graph token
 * from identity scopes). The server is still the only authority; this just fails fast without
 * sending the wrong token anywhere.
 */
function assertDirectoryAccessToken(token: string): void {
  const claims = decodePayload(token);
  if (!claims) throw new DirectoryError("not_an_access_token");
  const aud = typeof claims.aud === "string" ? claims.aud : "";
  if (GRAPH_AUDIENCES.has(aud)) throw new DirectoryError("wrong_audience");
  if (typeof claims.scp !== "string" || claims.scp.length === 0) throw new DirectoryError("not_an_access_token");
}

const REF_PATTERN = /^synergy:[1-9]\d{0,14}:[1-9]\d{0,14}$/;

export function isProjectRef(value: string): boolean {
  return REF_PATTERN.test(value);
}

export interface DirectoryClientOptions {
  /** Directory API origin, e.g. https://fd-project-directory.up.railway.app */
  baseUrl: string;
  /** Returns an access token for FD_DIRECTORY_SCOPE, e.g. msalAccessTokenProvider(msal, () => account). */
  getAccessToken: () => Promise<string>;
  fetch?: typeof fetch;
}

export function createDirectoryClient(opts: DirectoryClientOptions) {
  let base: URL;
  try {
    base = new URL(opts.baseUrl);
  } catch {
    throw new DirectoryError("insecure_base_url");
  }
  const local = base.hostname === "localhost" || base.hostname === "127.0.0.1" || base.hostname === "[::1]";
  if (base.protocol !== "https:" && !(base.protocol === "http:" && local)) throw new DirectoryError("insecure_base_url");
  const origin = base.origin;
  const doFetch = opts.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));

  async function get<T>(path: string, signal?: AbortSignal): Promise<T | null> {
    const token = await opts.getAccessToken();
    assertDirectoryAccessToken(token);
    let res: Response;
    try {
      res = await doFetch(origin + path, {
        method: "GET",
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        credentials: "omit",
        redirect: "error",
        signal,
      });
    } catch {
      throw new DirectoryError("network_error");
    }
    if (res.status === 404) return null;
    if (res.status === 401) throw new DirectoryError("unauthorized", 401);
    if (res.status === 403) throw new DirectoryError("forbidden", 403);
    if (res.status === 503) throw new DirectoryError("not_configured", 503);
    if (res.status === 400) throw new DirectoryError("bad_request", 400);
    if (!res.ok) throw new DirectoryError("http_error", res.status);
    return (await res.json()) as T;
  }

  return {
    async search(q: string, options: SearchOptions = {}): Promise<SearchResult> {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const include = [options.includeInactive && "inactive", options.includeArchived && "archived"].filter(Boolean);
      if (include.length) params.set("include", include.join(","));
      if (options.limit !== undefined) params.set("limit", String(options.limit));
      if (options.offset !== undefined) params.set("offset", String(options.offset));
      const qs = params.toString();
      const result = await get<SearchResult>(`/v1/projects${qs ? `?${qs}` : ""}`, options.signal);
      if (!result) throw new DirectoryError("http_error", 404);
      return result;
    },

    async get(ref: string | ProjectRef, signal?: AbortSignal): Promise<DirectoryProject | null> {
      const id = typeof ref === "string" ? ref : ref.ref;
      if (!isProjectRef(id)) return null;
      return get<DirectoryProject>(`/v1/projects/${encodeURIComponent(id)}`, signal);
    },

    /** Resolve a stored ref to the current project. Saved work is never hidden; the status says why it is unusual. */
    async resolve(ref: string | ProjectRef, signal?: AbortSignal): Promise<{ status: ResolveStatus; project: DirectoryProject | null }> {
      const project = await this.get(ref, signal);
      if (!project) return { status: "not_found", project: null };
      const status: ResolveStatus = project.missingSince
        ? "missing"
        : project.isActive === false
          ? "inactive"
          : project.isArchived
            ? "archived"
            : "active";
      return { status, project };
    },

    toProjectRef(project: DirectoryProject, now: Date = new Date()): ProjectRef {
      return {
        ref: project.id,
        organisationId: project.organisationId,
        synergyProjectId: project.synergyProjectId,
        label: project.label,
        capturedAt: now.toISOString(),
      };
    },

    /** Fee proposal prefill for a selected project. Null for an unknown or malformed ref. */
    async feeProposalPrefill(ref: string | ProjectRef, signal?: AbortSignal): Promise<FeeProposalPrefill | null> {
      const id = typeof ref === "string" ? ref : ref.ref;
      if (!isProjectRef(id)) return null;
      return get<FeeProposalPrefill>(`/v1/projects/${encodeURIComponent(id)}/fee-proposal-prefill`, signal);
    },

    async syncStatus(signal?: AbortSignal) {
      return get<{ lastSuccessfulSyncAt: string | null; stale: boolean; lastRun: Record<string, unknown> | null }>("/v1/sync-status", signal);
    },
  };
}

export type DirectoryClient = ReturnType<typeof createDirectoryClient>;


