import { renderHook, act } from '@testing-library/react';
import { useFeeProposal } from '../../hooks/useFeeProposal';
import { fieldProvenance } from '../../lib/field-provenance';
import type { DirectoryProject, FeeProposalPrefill } from '../../lib/vendor/fd-directory-client';
import { pending0406, project0406, REF_0406, served, served0406, served0406WithContacts } from '../../test-fixtures/directory-contract-v1';

type Hook = { current: ReturnType<typeof useFeeProposal> };

const REF_B = 'synergy:5466:10002';
const LABEL_B = 'FD-1002 Riverside School CFD';

function projectB(): DirectoryProject {
  return { ...project0406(), id: REF_B, synergyProjectId: 10002, label: LABEL_B, name: 'Riverside School CFD', numberFormatted: 'FD-1002' };
}

/** Project B: a different Client company, address and a named Client person. Fixture. */
function servedB(): FeeProposalPrefill {
  const body = served();
  body.fields.clientCompanyName = { value: 'Acme Developments', status: 'from_synergy', source: 'x' };
  body.fields.clientAddressLines = { value: ['1 Harbour Road, Cardiff', 'CF10 1AA'], status: 'from_synergy', source: 'x' };
  body.fields.clientFirstName = { value: 'Bob', status: 'from_synergy', source: 'x' };
  body.fields.clientSurname = { value: 'Client', status: 'from_synergy', source: 'x' };
  body.client = { ...body.client, displayName: 'Acme Developments', contactId: 9001 };
  return body;
}

function noCompanyB(): FeeProposalPrefill {
  const body = served();
  body.fields.clientCompanyName = { value: null, status: 'missing', source: null };
  body.fields.clientAddressLines = { value: null, status: 'missing', source: null };
  return body;
}

function link(result: Hook, project: DirectoryProject) {
  act(() => result.current.dispatch({ type: 'LINK_DIRECTORY_PROJECT', project }));
}
function apply(result: Hook, prefill: FeeProposalPrefill) {
  act(() => result.current.dispatch({ type: 'APPLY_DIRECTORY_PREFILL', prefill }));
}
function resolve(result: Hook, field: 'company' | 'names' | 'address' | 'projectName' | 'country', choice: 'use' | 'keep') {
  act(() => result.current.dispatch({ type: 'RESOLVE_DIRECTORY_PROPOSAL', field, choice }));
}
function set(result: Hook, field: 'company_name' | 'first_name' | 'surname' | 'address_lines', value: string | string[]) {
  act(() => result.current.dispatch({ type: 'SET_CLIENT', field, value }));
}

describe('project switch review: never overwrite what the user owns', () => {
  it('typed before choosing a project: offers the project value at the field instead of replacing it', () => {
    const { result } = renderHook(() => useFeeProposal());
    set(result, 'company_name', 'Typed Co');
    link(result, project0406());
    apply(result, served0406());
    const s = result.current.state;
    expect(s.client.company_name).toBe('Typed Co');
    expect(s.directory_proposals.company).toEqual({ ref: REF_0406, projectLabel: '0406 Former Homebase Site North Finchley', value: 'Taylor Wimpey North Thames' });
    expect(s.client.address_lines[0]).toBe('The Dock');
    expect(s.directory_proposals.address).toBeUndefined();
  });

  it('Use new value replaces the field and marks it as from Total Synergy', () => {
    const { result } = renderHook(() => useFeeProposal());
    set(result, 'company_name', 'Typed Co');
    link(result, project0406());
    apply(result, served0406());
    resolve(result, 'company', 'use');
    expect(result.current.state.client.company_name).toBe('Taylor Wimpey North Thames');
    expect(result.current.state.directory_proposals.company).toBeUndefined();
    expect(fieldProvenance(result.current.state).company).toEqual({ kind: 'synergy' });
  });

  it('Keep mine keeps the value and later polls of the same project do not ask again', () => {
    const { result } = renderHook(() => useFeeProposal());
    set(result, 'company_name', 'Typed Co');
    link(result, project0406());
    apply(result, served0406());
    resolve(result, 'company', 'keep');
    apply(result, served0406());
    apply(result, served0406WithContacts());
    expect(result.current.state.client.company_name).toBe('Typed Co');
    expect(result.current.state.directory_proposals.company).toBeUndefined();
  });

  it('editing a filled value does not make the same project ask to undo it', () => {
    const { result } = renderHook(() => useFeeProposal());
    link(result, project0406());
    apply(result, served0406());
    set(result, 'company_name', 'Taylor Wimpey UK');
    apply(result, served0406());
    expect(result.current.state.client.company_name).toBe('Taylor Wimpey UK');
    expect(result.current.state.directory_proposals).toEqual({});
  });

  it('A to B: refreshes untouched fields, proposes B values for edited ones, and answers are independent in any order', () => {
    const { result } = renderHook(() => useFeeProposal());
    link(result, project0406());
    apply(result, served0406());
    set(result, 'company_name', 'Taylor Wimpey UK');
    const lines = [...result.current.state.client.address_lines];
    lines[3] = 'Herts';
    set(result, 'address_lines', lines);
    act(() => result.current.dispatch({ type: 'UNLINK_SYNERGY_PROJECT' }));
    link(result, projectB());
    expect(result.current.state.project.project_name).toBe('Riverside School CFD');
    apply(result, servedB());
    let s = result.current.state;
    expect(s.client.first_name).toBe('Bob');
    expect(s.client.surname).toBe('Client');
    expect(s.project.country).toBe('EW');
    expect(s.client.company_name).toBe('Taylor Wimpey UK');
    expect(s.client.address_lines[3]).toBe('Herts');
    expect(s.directory_proposals.company?.value).toBe('Acme Developments');
    expect(s.directory_proposals.company?.projectLabel).toBe(LABEL_B);
    expect(s.directory_proposals.address?.value).toEqual(['1 Harbour Road', 'Cardiff', 'CF10 1AA', '', '', '']);
    expect(fieldProvenance(s).company).toEqual({ kind: 'carried', from: '0406 Former Homebase Site North Finchley' });

    resolve(result, 'address', 'use');
    s = result.current.state;
    expect(s.client.address_lines).toEqual(['1 Harbour Road', 'Cardiff', 'CF10 1AA', '', '', '']);
    expect(s.directory_proposals.company?.value).toBe('Acme Developments');
    resolve(result, 'company', 'keep');
    apply(result, servedB());
    s = result.current.state;
    expect(s.client.company_name).toBe('Taylor Wimpey UK');
    expect(s.directory_proposals).toEqual({});
    expect(fieldProvenance(s).address).toEqual({ kind: 'synergy' });
  });

  it('B with no value for an edited field keeps it, labelled as from the previous project, with nothing to propose', () => {
    const { result } = renderHook(() => useFeeProposal());
    link(result, project0406());
    apply(result, served0406());
    set(result, 'company_name', 'Taylor Wimpey UK');
    act(() => result.current.dispatch({ type: 'UNLINK_SYNERGY_PROJECT' }));
    link(result, projectB());
    apply(result, noCompanyB());
    const s = result.current.state;
    expect(s.client.company_name).toBe('Taylor Wimpey UK');
    expect(s.directory_proposals.company).toBeUndefined();
    expect(fieldProvenance(s).company).toEqual({ kind: 'carried', from: '0406 Former Homebase Site North Finchley' });
    expect(s.client.address_lines.every((l) => l === '')).toBe(true);
  });

  it('a picked company person is kept on a switch, labelled from the previous project, and B names are only proposed', () => {
    const { result } = renderHook(() => useFeeProposal());
    link(result, project0406());
    apply(result, served0406WithContacts());
    act(() => result.current.dispatch({ type: 'PICK_CLIENT_CONTACT', contactId: 12655215 }));
    act(() => result.current.dispatch({ type: 'UNLINK_SYNERGY_PROJECT' }));
    link(result, projectB());
    expect([result.current.state.client.first_name, result.current.state.client.surname]).toEqual(['Louie', 'Sharp']);
    expect(fieldProvenance(result.current.state).names).toEqual({ kind: 'carried', from: '0406 Former Homebase Site North Finchley' });
    apply(result, servedB());
    expect([result.current.state.client.first_name, result.current.state.client.surname]).toEqual(['Louie', 'Sharp']);
    expect(result.current.state.directory_proposals.names?.value).toEqual({ firstName: 'Bob', lastName: 'Client' });
    resolve(result, 'names', 'use');
    expect([result.current.state.client.first_name, result.current.state.client.surname]).toEqual(['Bob', 'Client']);
  });

  it('ignores a late response for A after B is chosen, and switching again drops B proposals', () => {
    const { result } = renderHook(() => useFeeProposal());
    set(result, 'company_name', 'Typed Co');
    link(result, projectB());
    apply(result, served0406());
    expect(result.current.state.directory_proposals).toEqual({});
    apply(result, servedB());
    expect(result.current.state.directory_proposals.company?.value).toBe('Acme Developments');
    act(() => result.current.dispatch({ type: 'UNLINK_SYNERGY_PROJECT' }));
    expect(result.current.state.directory_proposals).toEqual({});
    link(result, project0406());
    apply(result, pending0406());
    expect(result.current.state.directory_proposals).toEqual({});
    resolve(result, 'company', 'use');
    expect(result.current.state.client.company_name).toBe('Typed Co');
  });

  it('leaves engineer, location, PII and hourly rates alone throughout', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => {
      result.current.dispatch({ type: 'SET_FEE_OPTIONS', field: 'engineer_name', value: 'Kirsty Cameron' });
      result.current.dispatch({ type: 'SET_FEE_OPTIONS', field: 'pii_limit', value: 5000000 });
      result.current.dispatch({ type: 'SET_FEE_OPTIONS', field: 'include_hourly_rates', value: true });
      result.current.dispatch({ type: 'SET_PROJECT', field: 'project_location', value: 'Typed site' });
    });
    link(result, project0406());
    apply(result, served0406());
    link(result, projectB());
    apply(result, servedB());
    const s = result.current.state;
    expect([s.fee_options.engineer_name, s.fee_options.pii_limit, s.fee_options.include_hourly_rates, s.project.project_location]).toEqual([
      'Kirsty Cameron', 5000000, true, 'Typed site',
    ]);
  });
});
