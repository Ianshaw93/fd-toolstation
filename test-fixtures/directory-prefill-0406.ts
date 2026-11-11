// Fixture shaped on the directory's contractVersion 1 fee-proposal-prefill response for
// 0406 Former Homebase Site North Finchley. Values are the documented Synergy v2 reads
// (project 2694397, role 183340, assignment 18708053, contact 11518909). Field status
// labels other than lookup_pending / needs_review / verified are fixture placeholders.

export const REF_0406 = 'synergy:5466:2694397';
export const LABEL_0406 = '0406 Former Homebase Site North Finchley';

const CLIENT_SOURCE = 'ProjectContacts/Index (role Client)';

export interface FixtureField {
  value: unknown;
  status: string;
  source: string | null;
  review?: string[];
}

export interface FixturePrefill {
  contractVersion: number;
  project: { id: unknown; label: string; isActive: boolean; missingSince: string | null };
  source: Record<string, unknown>;
  siteAddress: { lines: string[]; country: string };
  projectManager: { name: string };
  fields: Record<string, FixtureField>;
  client: { lookup: string; status: string | null };
}

function base() {
  return {
    contractVersion: 1,
    project: { id: REF_0406, label: LABEL_0406, isActive: true, missingSince: null },
    source: {
      system: 'synergy',
      record: 'Projects/GetProjectById',
      sourceUpdatedAt: '2026-11-10T09:00:00Z',
      syncedAt: '2026-11-11T17:00:00Z',
      stale: false,
    },
    siteAddress: { lines: ['Ballards Lane', 'North Finchley', 'N12 0EH'], country: 'United Kingdom' },
    projectManager: { name: 'Sam Bennett' },
  };
}

export function pending0406(): FixturePrefill {
  const pending: FixtureField = { value: null, status: 'lookup_pending', source: CLIENT_SOURCE };
  return {
    ...base(),
    fields: {
      projectName: { value: 'Former Homebase Site North Finchley', status: 'found', source: 'Projects/GetProjectById' },
      projectLocation: { value: null, status: 'not_on_record', source: 'Projects/GetProjectById' },
      projectCountry: { value: null, status: 'manual', source: null },
      engineerName: { value: null, status: 'manual', source: null },
      clientFirstName: { ...pending },
      clientSurname: { ...pending },
      clientCompanyName: { ...pending },
      clientAddressLines: { ...pending },
      piiLimit: { value: null, status: 'manual', source: null },
      includeHourlyRates: { value: null, status: 'manual', source: null },
    },
    client: { lookup: 'pending', status: null },
  };
}

export function done0406(): FixturePrefill {
  return {
    ...base(),
    fields: {
      ...pending0406().fields,
      clientFirstName: { value: null, status: 'not_on_record', source: CLIENT_SOURCE },
      clientSurname: { value: null, status: 'not_on_record', source: CLIENT_SOURCE },
      clientCompanyName: { value: 'Taylor Wimpey North Thames', status: 'found', source: CLIENT_SOURCE },
      clientAddressLines: {
        value: ['The Dock,', 'Station road, Kings Langley', 'Hertfordshire', 'WD4 8LZ', 'United Kingdom', ''],
        status: 'needs_review',
        source: CLIENT_SOURCE,
        review: ['home_slot_on_company_record', 'hasAddress_false'],
      },
    },
    client: { lookup: 'done', status: 'found' },
  };
}

/** Unsigned JWT with the claims the pane checks before sending. Not a real token. */
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
