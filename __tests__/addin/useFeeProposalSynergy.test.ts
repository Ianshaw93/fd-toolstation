import { renderHook, act } from '@testing-library/react';
import { useFeeProposal } from '../../hooks/useFeeProposal';
import { renderFeeProposal } from '../../lib/word-addin-api';
import type { DirectoryProject, FeeProposalPrefill } from '../../lib/vendor/fd-directory-client';
import { pending0406, project0406, REF_0406, served0406 } from '../../test-fixtures/directory-contract-v1';

type Hook = { current: ReturnType<typeof useFeeProposal> };

function other(): DirectoryProject {
  return { ...project0406(), id: 'synergy:5466:1', synergyProjectId: 1, label: '0001 SYNTH Yard', name: 'SYNTH Yard', numberFormatted: '0001' };
}

function link(result: Hook, project: DirectoryProject) {
  act(() => result.current.dispatch({ type: 'LINK_DIRECTORY_PROJECT', project }));
}

function apply(result: Hook, prefill: FeeProposalPrefill) {
  act(() => result.current.dispatch({ type: 'APPLY_DIRECTORY_PREFILL', prefill }));
}

describe('useFeeProposal with the project directory', () => {
  it('links 0406 by its directory id and fills the project name from the hit', () => {
    const { result } = renderHook(() => useFeeProposal());
    link(result, project0406());
    expect(result.current.state.synergy_project_ref).toBe(REF_0406);
    expect(result.current.state.project.synergy_project_id).toBe(2694397);
    expect(result.current.state.project.organisation_id).toBe(5466);
    expect(result.current.state.project.synergy_project_label).toBe('0406 Former Homebase Site North Finchley');
    expect(result.current.state.project.project_name).toBe('Former Homebase Site North Finchley');
    expect(result.current.state.client.company_name).toBe('');
  });

  it('waits out the pending lookup, then fills the Client-role company and exact address', () => {
    const { result } = renderHook(() => useFeeProposal());
    link(result, project0406());
    apply(result, pending0406());
    expect(result.current.state.client.company_name).toBe('');
    expect(result.current.state.client_role_notice).toMatch(/looking up/i);
    apply(result, served0406());
    const { client, project, fee_options } = result.current.state;
    expect(client.company_name).toBe('Taylor Wimpey North Thames');
    expect(client.first_name).toBe('');
    expect(client.surname).toBe('');
    expect(client.address_lines).toEqual(['The Dock,', 'Station road, Kings Langley', 'Hertfordshire', 'WD4 8LZ', 'United Kingdom', '']);
    expect(project.project_location).toBe('');
    expect(project.country).toBe('EW');
    expect(fee_options.engineer_name).toBe('');
    expect(fee_options.pii_limit).toBe(100000);
    expect(fee_options.include_hourly_rates).toBe(false);
    expect(result.current.state.client_role_notice).toMatch(/home address slot/i);
  });

  it('never touches engineer, location, PII or hourly rates, even if the user set them', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => {
      result.current.dispatch({ type: 'SET_FEE_OPTIONS', field: 'engineer_name', value: 'Ada Lovelace' });
      result.current.dispatch({ type: 'SET_FEE_OPTIONS', field: 'pii_limit', value: 5000000 });
      result.current.dispatch({ type: 'SET_PROJECT', field: 'project_location', value: 'Typed site' });
    });
    link(result, project0406());
    apply(result, served0406());
    expect(result.current.state.fee_options.engineer_name).toBe('Ada Lovelace');
    expect(result.current.state.fee_options.pii_limit).toBe(5000000);
    expect(result.current.state.project.project_location).toBe('Typed site');
  });

  it('keeps typed client values', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => {
      result.current.dispatch({ type: 'SET_CLIENT', field: 'company_name', value: 'Typed Co' });
      result.current.dispatch({ type: 'SET_CLIENT', field: 'address_lines', value: ['1 Typed Street', '', '', '', '', ''] });
    });
    link(result, project0406());
    apply(result, served0406());
    expect(result.current.state.client.company_name).toBe('Typed Co');
    expect(result.current.state.client.address_lines[0]).toBe('1 Typed Street');
  });

  it('ignores a prefill for an earlier selection', () => {
    const { result } = renderHook(() => useFeeProposal());
    link(result, other());
    apply(result, served0406());
    expect(result.current.state.client.company_name).toBe('');
  });

  it('on a project switch, resets values it filled and keeps values the user edited', () => {
    const { result } = renderHook(() => useFeeProposal());
    link(result, project0406());
    apply(result, served0406());
    act(() => result.current.dispatch({ type: 'SET_CLIENT', field: 'first_name', value: 'Typed' }));
    act(() => result.current.dispatch({ type: 'UNLINK_SYNERGY_PROJECT' }));
    expect(result.current.state.client.company_name).toBe('Taylor Wimpey North Thames');
    link(result, other());
    expect(result.current.state.client.company_name).toBe('');
    expect(result.current.state.client.address_lines.every((line) => line === '')).toBe(true);
    expect(result.current.state.client.first_name).toBe('Typed');
    expect(result.current.state.project.project_name).toBe('SYNTH Yard');
  });

  it('keeps a company the user changed after it was filled', () => {
    const { result } = renderHook(() => useFeeProposal());
    link(result, project0406());
    apply(result, served0406());
    act(() => result.current.dispatch({ type: 'SET_CLIENT', field: 'company_name', value: 'Taylor Wimpey UK Ltd' }));
    link(result, other());
    expect(result.current.state.client.company_name).toBe('Taylor Wimpey UK Ltd');
  });

  it('notices only apply to the selected project', () => {
    const { result } = renderHook(() => useFeeProposal());
    link(result, project0406());
    act(() => result.current.dispatch({ type: 'SET_DIRECTORY_NOTICE', ref: 'synergy:5466:1', notice: 'stale' }));
    expect(result.current.state.client_role_notice).toBeNull();
    act(() => result.current.dispatch({ type: 'SET_DIRECTORY_NOTICE', ref: REF_0406, notice: 'now' }));
    expect(result.current.state.client_role_notice).toBe('now');
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
