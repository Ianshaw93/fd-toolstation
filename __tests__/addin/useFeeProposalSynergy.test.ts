import { renderHook, act } from '@testing-library/react';
import { useFeeProposal } from '../../hooks/useFeeProposal';

describe('useFeeProposal with Synergy project link', () => {
  it('links a synergy project and infers blank fields from directory details', () => {
    const { result } = renderHook(() => useFeeProposal());

    expect(result.current.state.project.project_name).toBe('');
    expect(result.current.state.project.project_location).toBe('');
    expect(result.current.state.client.first_name).toBe('');
    expect(result.current.state.client.surname).toBe('');
    expect(result.current.state.fee_options.engineer_name).toBe('');
    expect(result.current.state.project.synergy_project_id).toBeUndefined();

    act(() => {
      result.current.dispatch({
        type: 'LINK_SYNERGY_PROJECT',
        synergy_project_id: 1001,
        organisation_id: 5466,
        label: '0657 Panattoni California Drive',
        inferred_name: 'Panattoni California Drive',
        inferred_location: 'California Drive, Castleford',
        inferred_client: 'David Wilson',
        inferred_manager: 'Sam Bennett',
      });
    });

    expect(result.current.state.project.synergy_project_id).toBe(1001);
    expect(result.current.state.project.organisation_id).toBe(5466);
    expect(result.current.state.project.synergy_project_label).toBe('0657 Panattoni California Drive');
    expect(result.current.state.project.project_name).toBe('Panattoni California Drive');
    expect(result.current.state.project.project_location).toBe('California Drive, Castleford');
    expect(result.current.state.client.first_name).toBe('David');
    expect(result.current.state.client.surname).toBe('Wilson');
    expect(result.current.state.fee_options.engineer_name).toBe('Sam Bennett');

    // Build request includes the synergy IDs
    const req = result.current.buildRequest();
    expect(req.project.synergy_project_id).toBe(1001);
    expect(req.project.organisation_id).toBe(5466);
  });

  it('preserves existing user-typed inputs when linking a synergy project (no silent remap)', () => {
    const { result } = renderHook(() => useFeeProposal());

    // User types their own details first
    act(() => {
      result.current.dispatch({ type: 'SET_PROJECT', field: 'project_name', value: 'My Custom Project Title' });
      result.current.dispatch({ type: 'SET_PROJECT', field: 'project_location', value: 'London' });
      result.current.dispatch({ type: 'SET_CLIENT', field: 'first_name', value: 'Alice' });
      result.current.dispatch({ type: 'SET_CLIENT', field: 'surname', value: 'Smith' });
      result.current.dispatch({ type: 'SET_FEE_OPTIONS', field: 'engineer_name', value: 'Thomas O\'Driscoll' });
    });

    // Then links to a Synergy project
    act(() => {
      result.current.dispatch({
        type: 'LINK_SYNERGY_PROJECT',
        synergy_project_id: 1002,
        organisation_id: 5466,
        label: '0406 Former Homebase Site North Finchley',
        inferred_name: 'Former Homebase Site North Finchley',
        inferred_location: 'North Finchley, London',
        inferred_client: 'Sarah Jenkins',
        inferred_manager: 'Sam Bennett',
      });
    });

    // None of the user-entered inputs should be replaced
    expect(result.current.state.project.project_name).toBe('My Custom Project Title');
    expect(result.current.state.project.project_location).toBe('London');
    expect(result.current.state.client.first_name).toBe('Alice');
    expect(result.current.state.client.surname).toBe('Smith');
    expect(result.current.state.fee_options.engineer_name).toBe('Thomas O\'Driscoll');
    expect(result.current.state.project.synergy_project_id).toBe(1002);
    expect(result.current.state.project.organisation_id).toBe(5466);
  });

  it('unlinking clears synergy IDs but keeps inferred and typed values intact', () => {
    const { result } = renderHook(() => useFeeProposal());

    act(() => {
      result.current.dispatch({
        type: 'LINK_SYNERGY_PROJECT',
        synergy_project_id: 1001,
        organisation_id: 5466,
        label: '0657 Panattoni California Drive',
        inferred_name: 'Panattoni California Drive',
        inferred_location: 'California Drive, Castleford',
      });
    });

    expect(result.current.state.project.synergy_project_id).toBe(1001);

    act(() => {
      result.current.dispatch({ type: 'UNLINK_SYNERGY_PROJECT' });
    });

    expect(result.current.state.project.synergy_project_id).toBeUndefined();
    expect(result.current.state.project.organisation_id).toBeUndefined();
    expect(result.current.state.project.synergy_project_label).toBeUndefined();
    // Inferred values remain
    expect(result.current.state.project.project_name).toBe('Panattoni California Drive');
    expect(result.current.state.project.project_location).toBe('California Drive, Castleford');
  });

  it('generating works without any synergy selection (unlinked path)', () => {
    const { result } = renderHook(() => useFeeProposal());

    act(() => {
      result.current.dispatch({
        type: 'SET_PROJECT',
        field: 'project_name',
        value: 'Standalone Building',
      });
    });

    const req = result.current.buildRequest();
    expect(req.project.project_name).toBe('Standalone Building');
    expect(req.project.synergy_project_id).toBeUndefined();
  });
});
