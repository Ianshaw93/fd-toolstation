import { renderHook, act } from '@testing-library/react';
import { useFeeProposal } from '../../hooks/useFeeProposal';
import { fieldProvenance, provenanceAnnouncement } from '../../lib/field-provenance';
import { pending0406, project0406, served0406, served0406WithContacts } from '../../test-fixtures/directory-contract-v1';

type Hook = { current: ReturnType<typeof useFeeProposal> };

function filled0406(result: Hook, body = served0406WithContacts()) {
  act(() => result.current.dispatch({ type: 'LINK_DIRECTORY_PROJECT', project: project0406() }));
  act(() => result.current.dispatch({ type: 'APPLY_DIRECTORY_PREFILL', prefill: body }));
}

describe('where each filled value came from', () => {
  it('marks Total Synergy values, flags the address for review, and leaves empty or manual fields unmarked', () => {
    const { result } = renderHook(() => useFeeProposal());
    filled0406(result);
    const p = fieldProvenance(result.current.state);
    expect(p.company).toEqual({ kind: 'synergy' });
    expect(p.projectName).toEqual({ kind: 'synergy' });
    expect(p.address).toEqual({ kind: 'synergy', review: ['home_slot_on_company_record', 'hasAddress_false'] });
    expect(p.country).toBeNull();
    expect(p.names).toBeNull();
    expect(p.engineer).toBeNull();
  });

  it('counts the comma-split address as sourced', () => {
    const { result } = renderHook(() => useFeeProposal());
    filled0406(result);
    expect(result.current.state.client.address_lines).toHaveLength(6);
    expect(fieldProvenance(result.current.state).address?.kind).toBe('synergy');
  });

  it('says "edited" once the user changes a filled value, and a later poll does not undo it', () => {
    const { result } = renderHook(() => useFeeProposal());
    filled0406(result);
    act(() => result.current.dispatch({ type: 'SET_CLIENT', field: 'company_name', value: 'Taylor Wimpey UK' }));
    const lines = [...result.current.state.client.address_lines];
    lines[3] = 'Herts';
    act(() => result.current.dispatch({ type: 'SET_CLIENT', field: 'address_lines', value: lines }));
    act(() => result.current.dispatch({ type: 'APPLY_DIRECTORY_PREFILL', prefill: served0406WithContacts() }));
    const p = fieldProvenance(result.current.state);
    expect(p.company).toEqual({ kind: 'edited', was: 'synergy' });
    expect(p.address).toEqual({ kind: 'edited', was: 'synergy' });
    expect(result.current.state.client.company_name).toBe('Taylor Wimpey UK');
  });

  it('marks picked contact names, and edited once either name changes', () => {
    const { result } = renderHook(() => useFeeProposal());
    filled0406(result);
    act(() => result.current.dispatch({ type: 'PICK_CLIENT_CONTACT', contactId: 12655215 }));
    expect(fieldProvenance(result.current.state).names).toEqual({ kind: 'contact' });
    act(() => result.current.dispatch({ type: 'SET_CLIENT', field: 'surname', value: 'Sharpe' }));
    expect(fieldProvenance(result.current.state).names).toEqual({ kind: 'edited', was: 'contact' });
  });

  it('marks the engineer from Microsoft sign-in, and edited after a manual change', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => result.current.dispatch({ type: 'APPLY_ACCOUNT_ENGINEER', accountKey: 'a', engineer: 'Sam Bennett' }));
    expect(fieldProvenance(result.current.state).engineer).toEqual({ kind: 'microsoft' });
    act(() => result.current.dispatch({ type: 'SET_FEE_OPTIONS', field: 'engineer_name', value: 'Kirsty Cameron' }));
    expect(fieldProvenance(result.current.state).engineer).toEqual({ kind: 'edited', was: 'microsoft' });
  });

  it('shows nothing for a field the user filled from the start', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => result.current.dispatch({ type: 'SET_FEE_OPTIONS', field: 'engineer_name', value: 'Kirsty Cameron' }));
    act(() => result.current.dispatch({ type: 'SET_CLIENT', field: 'company_name', value: 'Typed Co' }));
    const p = fieldProvenance(result.current.state);
    expect(p.engineer).toBeNull();
    expect(p.company).toBeNull();
  });

  it('announces what was filled once, in words, and nothing while the lookup is pending', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => result.current.dispatch({ type: 'LINK_DIRECTORY_PROJECT', project: project0406() }));
    act(() => result.current.dispatch({ type: 'APPLY_DIRECTORY_PREFILL', prefill: pending0406() }));
    expect(provenanceAnnouncement(fieldProvenance(result.current.state))).toBe('Filled from Total Synergy: project name.');
    act(() => result.current.dispatch({ type: 'APPLY_DIRECTORY_PREFILL', prefill: served0406() }));
    const first = provenanceAnnouncement(fieldProvenance(result.current.state));
    expect(first).toBe('Filled from Total Synergy: company, address (check it), project name.');
    act(() => result.current.dispatch({ type: 'APPLY_DIRECTORY_PREFILL', prefill: served0406() }));
    expect(provenanceAnnouncement(fieldProvenance(result.current.state))).toBe(first);
  });
});
