// Payloads copied from fd-project-directory docs/api.md at 63b3d48 (PR #2).
// SERVED is the documented container e2e response: the client block and client fields are the
// sanitized 0406 payload, project / site / manager are the directory's mock project.
import type { DirectoryProject, FeeProposalPrefill, SearchResult } from '../lib/vendor/fd-directory-client';

export const SERVED_REF = 'synergy:5466:10002';

export function served(): FeeProposalPrefill {
  return {
    contractVersion: 1,
    project: { id: 'synergy:5466:10002', label: 'FD-1002 Riverside School CFD', isActive: true, missingSince: null },
    source: { system: 'total-synergy', record: 'Projects/Index', sourceUpdatedAt: '2026-09-12T10:30:00.000Z', syncedAt: '2026-11-11T17:56:18.706Z', stale: false },
    fields: {
      projectName: { value: 'Riverside School CFD', status: 'from_synergy', source: 'Projects/Index.name' },
      projectLocation: { value: null, status: 'not_in_source', source: null },
      projectCountry: { value: 'EW', status: 'from_synergy', sourceValue: 'Wales', source: 'Projects/Index.address.country' },
      engineerName: { value: null, status: 'not_in_source', source: null },
      clientFirstName: { value: null, source: 'ProjectContacts/Index.contact.firstName', status: 'missing' },
      clientSurname: { value: null, source: 'ProjectContacts/Index.contact.lastName', status: 'missing' },
      clientCompanyName: { value: 'Taylor Wimpey North Thames', source: 'ProjectContacts/Index.contact.name (contactTypeId 20 Company)', status: 'from_synergy' },
      clientAddressLines: {
        value: ['The Dock,', 'Station road, Kings Langley', 'Hertfordshire', 'WD4 8LZ', 'United Kingdom'],
        review: ['home_slot_on_company_record', 'hasAddress_false'],
        source: 'ProjectContacts/Index.contact.addressHome',
        status: 'needs_review',
      },
      piiLimit: { value: null, status: 'manual_only', source: null },
      includeHourlyRates: { value: null, status: 'manual_only', source: null },
    },
    siteAddress: { lines: ['Riverside Road', 'Unit 2'], town: 'Cardiff', state: null, postcode: 'CF10 1AA', country: 'Wales' },
    projectManager: { synergyManagerId: '302', name: 'Raj Patel', verifiedAsEngineer: false },
    client: {
      lookup: 'done', fetchedAt: '2026-11-11T17:56:19.298Z', errorCode: null, status: 'found',
      projectContactId: 18708053, contactId: 11518909, displayName: 'Taylor Wimpey North Thames', candidates: [],
    },
  };
}

/** The documented shape before the worker serves the Client lookup. */
export function pending(): FeeProposalPrefill {
  const body = served();
  const lookupPending = { value: null, status: 'lookup_pending' as const, source: 'ProjectContacts/Index (role Client)' };
  body.fields.clientFirstName = { ...lookupPending };
  body.fields.clientSurname = { ...lookupPending };
  body.fields.clientCompanyName = { ...lookupPending };
  body.fields.clientAddressLines = { ...lookupPending };
  body.client = { lookup: 'pending', fetchedAt: null, errorCode: null, status: null, projectContactId: null, contactId: null, displayName: null, candidates: [] };
  return body;
}

export const REF_0406 = 'synergy:5466:2694397';
export const LABEL_0406 = '0406 Former Homebase Site North Finchley';

/** The served client block on the 0406 project (fixture: project fields are not documented values). */
export function served0406(): FeeProposalPrefill {
  const body = served();
  body.project = { id: REF_0406, label: LABEL_0406, isActive: true, missingSince: null };
  body.fields.projectName = { value: 'Former Homebase Site North Finchley', status: 'from_synergy', source: 'Projects/Index.name' };
  body.fields.projectCountry = { value: null, status: 'unrecognised', sourceValue: 'United Kingdom', source: 'Projects/Index.address.country' };
  body.siteAddress = { lines: ['Ballards Lane'], town: 'London', state: null, postcode: 'N12 0EH', country: 'United Kingdom' };
  body.projectManager = { synergyManagerId: '301', name: 'Sam Bennett', verifiedAsEngineer: false };
  return body;
}

export function pending0406(): FeeProposalPrefill {
  const body = pending();
  const project = served0406();
  body.project = project.project;
  body.fields.projectName = project.fields.projectName;
  body.fields.projectCountry = project.fields.projectCountry;
  body.siteAddress = project.siteAddress;
  body.projectManager = project.projectManager;
  return body;
}

export function project0406(): DirectoryProject {
  return {
    id: REF_0406,
    organisationId: 5466,
    synergyProjectId: 2694397,
    label: LABEL_0406,
    numberFormatted: '0406',
    projectNumber: '0406',
    name: 'Former Homebase Site North Finchley',
    status: { name: 'In Progress', id: '2', typeId: '1' },
    isActive: true,
    isArchived: false,
    manager: { id: '301', name: 'Sam Bennett' },
    primaryContact: { id: '9001', name: 'Primary contact (not the Client role)' },
    office: { id: '11', name: 'London' },
    projectType: { id: '21', name: 'Fire Engineering' },
    tags: [],
    sourceUpdatedAt: '2026-10-01T09:00:00.000Z',
    syncedAt: '2026-11-11T09:00:01.000Z',
    missingSince: null,
  };
}

export function searchPage(items: DirectoryProject[], stale = false): SearchResult {
  return {
    items,
    page: { limit: 20, offset: 0, nextOffset: null, total: items.length },
    meta: { lastSuccessfulSyncAt: '2026-11-11T09:00:01.000Z', stale },
  };
}

/** Unsigned JWT carrying the claims the pane checks before sending. Not a real token. */
export function fixtureAccessToken(claims: Record<string, unknown> = {}): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({
      aud: 'api://2b180b8a-7cd3-40b2-83dd-8338103ce41e',
      tid: '8c535dde-8170-4909-8edc-40bbff4924ba',
      scp: 'access_as_user',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...claims,
    }),
    'fixture',
  ].join('.');
}
