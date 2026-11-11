import { readContactSuggestions } from '../../lib/client-contact-suggestions';
import { served0406, served0406WithContacts, TAYLOR_WIMPEY_PEOPLE } from '../../test-fixtures/directory-contract-v1';

type Body = ReturnType<typeof served0406WithContacts>;

function withPeople(people: unknown[], mutate?: (body: Body) => void): Body {
  const body = served0406();
  (body.client as unknown as { contactSuggestions: unknown[] }).contactSuggestions = people;
  mutate?.(body);
  return body;
}

describe('company contact suggestions (proposed client.contactSuggestions)', () => {
  it('reads the three Taylor Wimpey North Thames people with their structured names', () => {
    expect(readContactSuggestions(served0406WithContacts())).toEqual({
      companyName: 'Taylor Wimpey North Thames',
      people: [
        { id: 12655215, displayName: 'Louie Sharp', firstName: 'Louie', lastName: 'Sharp' },
        { id: 11518910, displayName: 'Matt Christensen', firstName: 'Matt', lastName: 'Christensen' },
        { id: 12557134, displayName: 'Tyler Watkins', firstName: 'Tyler', lastName: 'Watkins' },
      ],
    });
  });

  it('is empty when the field is absent, so names stay manual', () => {
    expect(readContactSuggestions(served0406())).toEqual({ companyName: 'Taylor Wimpey North Thames', people: [] });
  });

  it('keeps only active company people whose company is the found Client', () => {
    const [louie, matt, tyler] = TAYLOR_WIMPEY_PEOPLE;
    const body = withPeople([
      louie,
      { ...matt, companyId: 999 },
      { ...tyler, association: 'project' },
      { ...tyler, id: 5, isActive: false },
      { ...tyler, id: 6, source: 'project-emails' },
      { ...tyler, id: 7, firstName: null, lastName: null },
      'not a person',
    ]);
    expect(readContactSuggestions(body).people.map((p) => p.id)).toEqual([12655215]);
  });

  it('offers no people unless the Client lookup found the company', () => {
    const body = withPeople(TAYLOR_WIMPEY_PEOPLE, (b) => {
      b.client = { ...b.client, status: 'multiple_client_roles' };
    });
    expect(readContactSuggestions(body).people).toEqual([]);
  });

  it('does not split a display name when a name part is missing', () => {
    const body = withPeople([{ ...TAYLOR_WIMPEY_PEOPLE[0], lastName: null }]);
    expect(readContactSuggestions(body).people).toEqual([{ id: 12655215, displayName: 'Louie Sharp', firstName: 'Louie', lastName: '' }]);
  });

  it('never carries contact details through', () => {
    const body = withPeople([{ ...TAYLOR_WIMPEY_PEOPLE[0], email: 'x@y', phone: '1', addressHome: { address1: 'z' } }]);
    expect(Object.keys(readContactSuggestions(body).people[0]).sort()).toEqual(['displayName', 'firstName', 'id', 'lastName']);
  });
});
