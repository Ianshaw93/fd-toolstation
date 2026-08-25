import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import ProjectDetailsSection from '../../components/fee-proposal/ProjectDetailsSection';
import { useFeeProposal } from '../../hooks/useFeeProposal';
import type { ProjectDetails } from '../../lib/fee-types';

const defaultProject: ProjectDetails = {
  project_name: '',
  project_location: '',
  country: 'EW',
  vat_applicable: true,
};

function renderSection(overrides: Partial<ProjectDetails> = {}) {
  const dispatch = jest.fn();
  const project = { ...defaultProject, ...overrides };
  const result = render(<ProjectDetailsSection project={project} dispatch={dispatch} />);
  return { ...result, dispatch };
}

describe('ProjectDetailsSection country and VAT', () => {
  it('offers England or Wales, Jersey and Other', () => {
    renderSection();
    expect(screen.getByLabelText('England or Wales')).toBeInTheDocument();
    expect(screen.getByLabelText('Jersey')).toBeInTheDocument();
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });

  it('hides the VAT question for England or Wales and Jersey', () => {
    renderSection({ country: 'EW' });
    expect(screen.queryByLabelText('Yes')).not.toBeInTheDocument();
    renderSection({ country: 'J', vat_applicable: false });
    expect(screen.queryByLabelText('Yes')).not.toBeInTheDocument();
  });

  it('shows the VAT question when Other is selected', () => {
    renderSection({ country: 'OTHER', vat_applicable: false });
    expect(screen.getByLabelText('Yes')).not.toBeChecked();
    expect(screen.getByLabelText('No')).toBeChecked();
  });

  it('dispatches the country selection', () => {
    const { dispatch } = renderSection();
    fireEvent.click(screen.getByLabelText('Other'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_PROJECT', field: 'country', value: 'OTHER' });
  });

  it('dispatches the VAT selection', () => {
    const { dispatch } = renderSection({ country: 'OTHER', vat_applicable: false });
    fireEvent.click(screen.getByLabelText('Yes'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_PROJECT', field: 'vat_applicable', value: true });
  });
});

describe('useFeeProposal country/VAT state', () => {
  it('defaults to England or Wales with VAT applicable', () => {
    const { result } = renderHook(() => useFeeProposal());
    expect(result.current.state.project.country).toBe('EW');
    expect(result.current.state.project.vat_applicable).toBe(true);
  });

  it('clears VAT when switching to Jersey and to Other', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'country', value: 'J' }));
    expect(result.current.state.project.vat_applicable).toBe(false);
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'country', value: 'OTHER' }));
    expect(result.current.state.project.vat_applicable).toBe(false);
  });

  it('restores VAT when switching back to England or Wales', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'country', value: 'J' }));
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'country', value: 'EW' }));
    expect(result.current.state.project.vat_applicable).toBe(true);
  });

  it('sends the VAT choice for Other in the generated request', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'country', value: 'OTHER' }));
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'vat_applicable', value: true }));
    const request = result.current.buildRequest();
    expect(request.project.country).toBe('OTHER');
    expect(request.project.vat_applicable).toBe(true);
  });
});
