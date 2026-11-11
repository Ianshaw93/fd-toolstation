import { engineerForAccount } from '../../lib/engineer-identity';
import type { Engineer } from '../../lib/fee-types';

const roster: Engineer[] = [
  { full_name: 'Sam Bennett', email_prefix: 'sam', phone_number: '', job_title: '' },
  { full_name: "Thomas O'Driscoll", email_prefix: 'thomas', phone_number: '', job_title: '' },
  { full_name: 'Kirsty Cameron', email_prefix: 'kirsty', phone_number: '', job_title: '' },
];

describe('engineer for the signed-in Microsoft account', () => {
  it('matches the FD username to the roster email prefix the letter already uses', () => {
    expect(engineerForAccount({ key: 'a', username: 'Sam@firedynamicsgroup.com', name: 'S. Bennett (FD)' }, roster)).toBe('Sam Bennett');
  });

  it('otherwise matches the exact display name', () => {
    expect(engineerForAccount({ key: 'a', username: 'k.cameron@firedynamicsgroup.com', name: '  kirsty   cameron ' }, roster)).toBe('Kirsty Cameron');
  });

  it('does not guess from an email or a partial name', () => {
    expect(engineerForAccount({ key: 'a', username: 'sam.bennett@firedynamicsgroup.com', name: 'Samuel Bennett' }, roster)).toBeNull();
    expect(engineerForAccount({ key: 'a', username: 'sam@example.com', name: 'Someone Else' }, roster)).toBeNull();
    expect(engineerForAccount({ key: 'a', username: 'thomas@firedynamicsgroup.com.evil', name: '' }, roster)).toBeNull();
  });

  it('chooses nobody when the roster has two matches', () => {
    const twice = [...roster, { full_name: 'Sam Bennett', email_prefix: 'sbennett', phone_number: '', job_title: '' }];
    expect(engineerForAccount({ key: 'a', username: 'x@firedynamicsgroup.com', name: 'Sam Bennett' }, twice)).toBeNull();
  });

  it('has no engineer without an account', () => {
    expect(engineerForAccount(null, roster)).toBeNull();
  });
});
