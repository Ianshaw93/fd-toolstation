import { readContactSuggestions } from '../../lib/client-contact-suggestions';
import { applyContactSuggestion, type PrefillTarget } from '../../lib/vendor/fd-directory-client';
import { pending0406, served0406, served0406WithContacts, TAYLOR_WIMPEY_PEOPLE, withCompanyContacts } from '../../test-fixtures/directory-contract-v1';

describe('company contacts from client.companyContacts / client.contactSuggestions (c120cec)', () => {
  it('offers the three Taylor Wimpey North Thames people once the company lookup is done', () => {
    const read = readContactSuggestions(served0406WithContacts());
    expect(read.lookup).toBe('done');
    expect(read.companyName).toBe('Taylor Wimpey North Thames');
    expect(read.people.map((p) => [p.id, p.displayName, p.firstName, p.lastName])).toEqual([
      [12655215, 'Louie Sharp', 'Louie', 'Sharp'],
      [11518910, 'Matt Christensen', 'Matt', 'Christensen'],
      [12557134, 'Tyler Watkins', 'Tyler', 'Watkins'],
    ]);
    expect(read.truncated).toBe(false);
  });

  it('reports pending, failed and not_applicable with no people', () => {
    expect(readContactSuggestions(served0406())).toMatchObject({ lookup: 'pending', people: [] });
    expect(readContactSuggestions(withCompanyContacts(served0406(), { lookup: 'failed', errorCode: 'synergy_timeout' }))).toMatchObject({
      lookup: 'failed',
      errorCode: 'synergy_timeout',
      people: [],
    });
    expect(readContactSuggestions(pending0406())).toMatchObject({ lookup: 'not_applicable', people: [] });
  });

  it('ignores people sent with any lookup other than done', () => {
    const body = withCompanyContacts(served0406(), { lookup: 'pending' }, TAYLOR_WIMPEY_PEOPLE);
    expect(readContactSuggestions(body).people).toEqual([]);
  });

  it('keeps the truncated flag', () => {
    const body = withCompanyContacts(served0406(), { lookup: 'done', truncated: true }, TAYLOR_WIMPEY_PEOPLE);
    expect(readContactSuggestions(body)).toMatchObject({ truncated: true });
    expect(readContactSuggestions(body).people).toHaveLength(3);
  });

  it('drops anyone not at the Client company or not marked as a company contact', () => {
    const [louie, matt, tyler] = TAYLOR_WIMPEY_PEOPLE;
    const body = withCompanyContacts(served0406(), { lookup: 'done' }, [
      louie,
      { ...matt, companyId: 999 },
      { ...tyler, association: 'project' as never },
    ]);
    expect(readContactSuggestions(body).people.map((p) => p.id)).toEqual([12655215]);
  });

  it('keeps a missing name part missing, and the shared pick leaves it empty instead of splitting', () => {
    const louie = { ...TAYLOR_WIMPEY_PEOPLE[0], lastName: null };
    const body = withCompanyContacts(served0406(), { lookup: 'done' }, [louie]);
    const [person] = readContactSuggestions(body).people;
    expect(person.lastName).toBeNull();
    const form: PrefillTarget = {
      projectName: 'P',
      projectCountry: 'EW',
      clientFirstName: 'Typed',
      clientSurname: 'Name',
      clientCompanyName: 'Taylor Wimpey North Thames',
      clientAddressLines: ['The Dock', '', '', '', '', ''],
    };
    expect(applyContactSuggestion(form, person)).toEqual({ ...form, clientFirstName: 'Louie', clientSurname: '' });
  });
});
