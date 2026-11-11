import {
  applyMissingClientSource,
  applySynergyEnrichment,
  parseFeeEnrichment,
  readOfficialProjectClient,
  SYNERGY_CLIENT_PROJECT_MANAGER_ROLE_ID,
  SYNERGY_CLIENT_ROLE_ID,
} from '../../lib/synergy-client-enrichment';
import type { FeeAutofillState } from '../../lib/synergy-client-enrichment';

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

const oneClient = {
  organisation_id: 5466,
  synergy_project_id: 1,
  label: '0001 SYNTH Yard',
  project_name: 'SYNTH Yard',
  project_location: '1 Site Road',
  country: 'J',
  client_roles: [
    {
      role: 'Client',
      role_id: SYNERGY_CLIENT_ROLE_ID,
      company_name: 'SYNTH Client Ltd',
      address_lines: ['10 Client Street', 'Client Town', 'CT1 1AA'],
      contact: { first_name: 'Ada', surname: 'Lovelace' },
    },
  ],
  engineer_name: 'Ada Lovelace',
  pii_limit: 250000,
  include_hourly_rates: true,
};

describe('Synergy client-role autofill', () => {
  it('fills the company, its address, and a structured person from the single Client role', () => {
    const parsed = parseFeeEnrichment(oneClient);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const next = applySynergyEnrichment(blank(), parsed.enrichment, ENGINEERS);
    expect(next.company_name).toBe('SYNTH Client Ltd');
    expect(next.first_name).toBe('Ada');
    expect(next.surname).toBe('Lovelace');
    expect(next.address_lines.slice(0, 3)).toEqual(['10 Client Street', 'Client Town', 'CT1 1AA']);
    expect(next.project_name).toBe('SYNTH Yard');
    expect(next.project_location).toBe('1 Site Road');
    expect(next.country).toBe('J');
    expect(next.engineer_name).toBe('Ada Lovelace');
    expect(next.pii_limit).toBe(250000);
    expect(next.include_hourly_rates).toBe(true);
    expect(next.notice).toBeNull();
  });

  it('does not treat a company name as a person when the Client role has no contact', () => {
    const parsed = parseFeeEnrichment({
      ...oneClient,
      client_roles: [
        {
          role: 'Client',
          company_name: 'SYNTH Client Ltd',
          address_lines: ['10 Client Street'],
          contact: null,
        },
      ],
      engineer_name: null,
      pii_limit: null,
      include_hourly_rates: null,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const next = applySynergyEnrichment(blank(), parsed.enrichment, ENGINEERS);
    expect(next.company_name).toBe('SYNTH Client Ltd');
    expect(next.first_name).toBe('');
    expect(next.surname).toBe('');
    expect(next.engineer_name).toBe('');
    expect(next.pii_limit).toBe(100000);
    expect(next.include_hourly_rates).toBe(false);
  });

  it('ignores an Index hit that only has primaryContact, client_name, manager, or a site address', () => {
    const parsed = parseFeeEnrichment({
      id: 406,
      numberFormatted: '0406',
      name: 'SYNTH Site',
      client_name: 'SYNTH Holdings Ltd',
      primaryContact: 'Pat Example',
      manager: 'Test Manager',
      location: '1 Site Road',
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('contract_missing');
  });

  it('does not choose the first Client role when several are present', () => {
    const parsed = parseFeeEnrichment({
      ...oneClient,
      client_roles: [
        oneClient.client_roles[0],
        {
          role: 'Client',
          company_name: 'Other SYNTH Ltd',
          address_lines: ['99 Other Street'],
          contact: { first_name: 'Grace', surname: 'Hopper' },
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const next = applySynergyEnrichment(blank(), parsed.enrichment, ENGINEERS);
    expect(next.company_name).toBe('');
    expect(next.first_name).toBe('');
    expect(next.address_lines.every((line) => line === '')).toBe(true);
    expect(next.notice).toMatch(/more than one Client role/i);
  });

  it('leaves client fields blank when the project has no Client role', () => {
    const parsed = parseFeeEnrichment({ ...oneClient, client_roles: [] });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const next = applySynergyEnrichment(blank(), parsed.enrichment, ENGINEERS);
    expect(next.company_name).toBe('');
    expect(next.first_name).toBe('');
    expect(next.notice).toMatch(/no Client role/i);
  });

  it('does not guess a missing address line or an engineer who is not on the fee list', () => {
    const parsed = parseFeeEnrichment({
      ...oneClient,
      country: null,
      engineer_name: 'Test Manager',
      client_roles: [
        {
          role: 'Client',
          company_name: 'SYNTH Client Ltd',
          address_lines: ['10 Client Street'],
          contact: { first_name: 'Ada', surname: '' },
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const next = applySynergyEnrichment(blank(), parsed.enrichment, ENGINEERS);
    expect(next.address_lines[0]).toBe('10 Client Street');
    expect(next.address_lines.slice(1).every((line) => line === '')).toBe(true);
    expect(next.surname).toBe('');
    expect(next.engineer_name).toBe('');
    expect(next.country).toBe('EW');
  });

  it('keeps a manual edit and ignores a stale enrichment from an earlier project', () => {
    const started = blank();
    started.project_name = 'Typed title';
    started.first_name = 'Manual';
    const parsed = parseFeeEnrichment(oneClient);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const kept = applySynergyEnrichment(started, parsed.enrichment, ENGINEERS);
    expect(kept.project_name).toBe('Typed title');
    expect(kept.first_name).toBe('Manual');
    expect(kept.company_name).toBe('SYNTH Client Ltd');

    const stale = applySynergyEnrichment(kept, parsed.enrichment, ENGINEERS, {
      generation: 1,
      currentGeneration: 2,
    });
    expect(stale).toBe(kept);
  });

  it('does not label the 0406 primary contact as Client or copy the empty site address', () => {
    // Shape of the official GetProjectById read. Not a live autofill claim.
    const official = {
      id: 2694397,
      numberFormatted: '0406',
      projectNumber: 'P0406',
      name: 'Former Homebase Site North Finchley',
      primaryContactId: 11518909,
      primaryContactName: 'Taylor Wimpey North Thames',
      site: { address1: null, address2: null, town: null, state: null, zipCode: null, country: null },
    };
    expect(parseFeeEnrichment(official).ok).toBe(false);
    const read = readOfficialProjectClient(official);
    expect(read.status).toBe('unavailable');
    if (read.status !== 'unavailable') return;
    expect(read.reason).toBe('no_client_role_assignment');
    expect(read.project_name).toBe('Former Homebase Site North Finchley');

    const next = applyMissingClientSource(blank(), {
      project_name: read.project_name,
      project_location: null,
    });
    expect(next.company_name).toBe('');
    expect(next.first_name).toBe('');
    expect(next.surname).toBe('');
    expect(next.address_lines.every((line) => line === '')).toBe(true);
    expect(next.project_location).toBe('');
    expect(next.project_name).toBe('Former Homebase Site North Finchley');
    expect(JSON.stringify(next)).not.toContain('Taylor');
    expect(JSON.stringify(next)).not.toContain('Wimpey');
    expect(next.notice).toMatch(/primary contact was not used/i);
  });

  it('keeps a typed company, person, and address when the project read has no Client role', () => {
    const typed = blank();
    typed.company_name = 'Typed Company Ltd';
    typed.first_name = 'Manual';
    typed.surname = 'Person';
    typed.address_lines = ['1 Typed Street', '', '', '', '', ''];
    typed.project_location = 'Typed location';
    typed.project_name = 'Typed title';
    const read = readOfficialProjectClient({
      id: 2694397,
      primaryContactName: 'Taylor Wimpey North Thames',
      name: 'Former Homebase Site North Finchley',
      site: { address1: '99 Site Road', town: 'London', country: 'England' },
    });
    expect(read.status).toBe('unavailable');
    if (read.status !== 'unavailable') return;
    const next = applyMissingClientSource(typed, {
      project_name: read.project_name,
      project_location: null,
    });
    expect(next.company_name).toBe('Typed Company Ltd');
    expect(next.first_name).toBe('Manual');
    expect(next.surname).toBe('Person');
    expect(next.address_lines[0]).toBe('1 Typed Street');
    expect(next.project_location).toBe('Typed location');
    expect(next.project_name).toBe('Typed title');
    expect(next.address_lines.join(' ')).not.toContain('99 Site Road');
  });

  it('does not treat Client Project Manager as the Client role, and does not copy site into the company address', () => {
    const parsed = parseFeeEnrichment({
      ...oneClient,
      site: { address1: '99 Site Road', town: 'London' },
      primaryContactName: 'Taylor Wimpey North Thames',
      client_roles: [
        {
          role: 'Client Project Manager',
          role_id: SYNERGY_CLIENT_PROJECT_MANAGER_ROLE_ID,
          company_name: 'SYNTH Client Ltd',
          address_lines: ['10 Client Street'],
          contact: { first_name: 'Ada', surname: 'Lovelace' },
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.enrichment.client_roles).toHaveLength(0);
    const next = applySynergyEnrichment(blank(), parsed.enrichment, ENGINEERS);
    expect(next.company_name).toBe('');
    expect(next.first_name).toBe('');
    expect(next.address_lines[0]).toBe('');
    expect(next.address_lines.join(' ')).not.toContain('99 Site Road');
    expect(next.notice).toMatch(/no Client role/i);

    const mislabeled = parseFeeEnrichment({
      ...oneClient,
      client_roles: [
        {
          role: 'Client',
          role_id: SYNERGY_CLIENT_PROJECT_MANAGER_ROLE_ID,
          company_name: 'SYNTH Client Ltd',
          address_lines: ['10 Client Street'],
          contact: { first_name: 'Ada', surname: 'Lovelace' },
        },
      ],
    });
    expect(mislabeled.ok).toBe(true);
    if (!mislabeled.ok) return;
    expect(mislabeled.enrichment.client_roles).toHaveLength(0);
  });
});
