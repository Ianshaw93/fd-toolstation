import { renderHook, act } from '@testing-library/react';
import { useFeeProposal } from '../../hooks/useFeeProposal';
import { parseFeeEnrichment, SYNERGY_CLIENT_ROLE_ID } from '../../lib/synergy-client-enrichment';
import { renderFeeProposal } from '../../lib/word-addin-api';

const explicitClient = {
  organisation_id: 5466,
  synergy_project_id: 1,
  label: '0001 SYNTH Yard',
  project_name: 'SYNTH Yard',
  project_location: '1 Project Road',
  country: 'EW' as const,
  client_roles: [
    {
      role: 'Client',
      role_id: SYNERGY_CLIENT_ROLE_ID,
      company_name: 'SYNTH Client Ltd',
      address_lines: ['10 Client Street', 'Client Town'],
      contact: { first_name: 'Ada', surname: 'Lovelace' },
    },
  ],
  engineer_name: null,
  pii_limit: null,
  include_hourly_rates: null,
};

describe('useFeeProposal with Synergy project link', () => {
  it('links the project name and leaves client fields for the user when no Client role was returned', () => {
    const { result } = renderHook(() => useFeeProposal());

    act(() => {
      result.current.dispatch({
        type: 'LINK_SYNERGY_PROJECT',
        synergy_project_id: 2694397,
        organisation_id: 5466,
        label: '0406 Former Homebase Site North Finchley',
        generation: 1,
        project_name: 'Former Homebase Site North Finchley',
        project_location: null,
      });
    });

    expect(result.current.state.project.synergy_project_id).toBe(2694397);
    expect(result.current.state.project.organisation_id).toBe(5466);
    expect(result.current.state.project.project_name).toBe('Former Homebase Site North Finchley');
    expect(result.current.state.project.project_location).toBe('');
    expect(result.current.state.client.company_name).toBe('');
    expect(result.current.state.client.first_name).toBe('');
    expect(result.current.state.client.surname).toBe('');
    expect(result.current.state.fee_options.engineer_name).toBe('');
    expect(result.current.state.client_role_notice).toMatch(/primary contact was not used/i);

    const req = result.current.buildRequest();
    expect(req.project.synergy_project_id).toBe(2694397);
    expect(req.client.company_name).toBe('');
    expect(req.client.first_name).toBe('');
  });

  it('preserves existing user-typed inputs when linking a synergy project', () => {
    const { result } = renderHook(() => useFeeProposal());

    act(() => {
      result.current.dispatch({ type: 'SET_PROJECT', field: 'project_name', value: 'My Custom Project Title' });
      result.current.dispatch({ type: 'SET_PROJECT', field: 'project_location', value: 'London' });
      result.current.dispatch({ type: 'SET_CLIENT', field: 'company_name', value: 'Typed Company Ltd' });
      result.current.dispatch({ type: 'SET_CLIENT', field: 'first_name', value: 'Alice' });
      result.current.dispatch({ type: 'SET_CLIENT', field: 'surname', value: 'Smith' });
      result.current.dispatch({ type: 'SET_FEE_OPTIONS', field: 'engineer_name', value: 'Thomas O\'Driscoll' });
    });

    act(() => {
      result.current.dispatch({
        type: 'LINK_SYNERGY_PROJECT',
        synergy_project_id: 2694397,
        organisation_id: 5466,
        label: '0406 Former Homebase Site North Finchley',
        generation: 1,
        project_name: 'Former Homebase Site North Finchley',
        project_location: null,
      });
    });

    expect(result.current.state.project.project_name).toBe('My Custom Project Title');
    expect(result.current.state.project.project_location).toBe('London');
    expect(result.current.state.client.company_name).toBe('Typed Company Ltd');
    expect(result.current.state.client.first_name).toBe('Alice');
    expect(result.current.state.client.surname).toBe('Smith');
    expect(result.current.state.fee_options.engineer_name).toBe('Thomas O\'Driscoll');
    expect(result.current.state.project.synergy_project_id).toBe(2694397);
  });

  it('fills the company from an explicit Client role and keeps it off the first name', () => {
    const { result } = renderHook(() => useFeeProposal());
    const parsed = parseFeeEnrichment(explicitClient);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    act(() => {
      result.current.dispatch({
        type: 'LINK_SYNERGY_PROJECT',
        synergy_project_id: 1,
        organisation_id: 5466,
        label: '0001 SYNTH Yard',
        generation: 1,
        project_name: 'SYNTH Yard',
        project_location: '1 Project Road',
      });
      result.current.dispatch({
        type: 'APPLY_SYNERGY_ENRICHMENT',
        generation: 1,
        enrichment: parsed.enrichment,
        engineer_names: ['Ada Lovelace'],
      });
    });

    expect(result.current.state.client.company_name).toBe('SYNTH Client Ltd');
    expect(result.current.state.client.first_name).toBe('Ada');
    expect(result.current.state.client.surname).toBe('Lovelace');
    expect(result.current.state.client.address_lines[0]).toBe('10 Client Street');
    expect(result.current.state.client.first_name).not.toBe(result.current.state.client.company_name);
  });

  it('ignores a client enrichment from an earlier selection', () => {
    const { result } = renderHook(() => useFeeProposal());
    const parsed = parseFeeEnrichment(explicitClient);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    act(() => {
      result.current.dispatch({
        type: 'LINK_SYNERGY_PROJECT',
        synergy_project_id: 2,
        organisation_id: 5466,
        label: '0002 SYNTH Other',
        generation: 2,
        project_name: 'SYNTH Other',
        project_location: null,
      });
      result.current.dispatch({
        type: 'APPLY_SYNERGY_ENRICHMENT',
        generation: 1,
        enrichment: parsed.enrichment,
        engineer_names: ['Ada Lovelace'],
      });
    });

    expect(result.current.state.project.synergy_project_id).toBe(2);
    expect(result.current.state.project.project_name).toBe('SYNTH Other');
    expect(result.current.state.client.company_name).toBe('');
    expect(result.current.state.client.first_name).toBe('');
  });

  it('unlinking clears synergy IDs but keeps typed values intact', () => {
    const { result } = renderHook(() => useFeeProposal());

    act(() => {
      result.current.dispatch({
        type: 'LINK_SYNERGY_PROJECT',
        synergy_project_id: 1,
        organisation_id: 5466,
        label: '0001 SYNTH Yard',
        generation: 1,
        project_name: 'SYNTH Yard',
        project_location: '1 Project Road',
      });
    });

    act(() => {
      result.current.dispatch({ type: 'UNLINK_SYNERGY_PROJECT' });
    });

    expect(result.current.state.project.synergy_project_id).toBeUndefined();
    expect(result.current.state.project.organisation_id).toBeUndefined();
    expect(result.current.state.project.synergy_project_label).toBeUndefined();
    expect(result.current.state.project.project_name).toBe('SYNTH Yard');
    expect(result.current.state.project.project_location).toBe('1 Project Road');
    expect(result.current.state.client_role_notice).toBeNull();
  });

  it('generating works without any synergy selection', () => {
    const { result } = renderHook(() => useFeeProposal());

    act(() => {
      result.current.dispatch({ type: 'SET_PROJECT', field: 'project_name', value: 'Standalone Building' });
    });

    const req = result.current.buildRequest();
    expect(req.project.project_name).toBe('Standalone Building');
    expect(req.project.synergy_project_id).toBeUndefined();
  });

  it('posts the company separately from the person on the Word render', async () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => {
      result.current.dispatch({ type: 'SET_CLIENT', field: 'company_name', value: 'SYNTH Client Ltd' });
      result.current.dispatch({ type: 'SET_CLIENT', field: 'first_name', value: 'Ada' });
      result.current.dispatch({ type: 'SET_CLIENT', field: 'surname', value: 'Lovelace' });
      result.current.dispatch({ type: 'SET_CLIENT', field: 'address_lines', value: ['10 Client Street', '', '', '', '', ''] });
      result.current.dispatch({ type: 'SET_PROJECT', field: 'project_name', value: 'SYNTH Yard' });
      result.current.dispatch({ type: 'SET_FEE_OPTIONS', field: 'engineer_name', value: 'Ada Lovelace' });
    });
    const req = result.current.buildRequest();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const previous = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await renderFeeProposal(req);
    } finally {
      global.fetch = previous;
    }
    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/word/fee-proposal/render',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.client.company_name).toBe('SYNTH Client Ltd');
    expect(body.client.first_name).toBe('Ada');
    expect(body.client.surname).toBe('Lovelace');
    expect(body.client.address_lines).toEqual(['10 Client Street']);
    expect(body.client.first_name).not.toBe(body.client.company_name);
  });
});
