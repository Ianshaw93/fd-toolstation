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
  legislation: '',
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

  it('hides the VAT and legislation questions for England or Wales and Jersey', () => {
    renderSection({ country: 'EW' });
    expect(screen.queryByLabelText('Yes')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Legislation')).not.toBeInTheDocument();
    renderSection({ country: 'J', vat_applicable: false });
    expect(screen.queryByLabelText('Yes')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Legislation')).not.toBeInTheDocument();
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

  it('shows the legislation field with both built-in references when Other is selected', () => {
    renderSection({ country: 'OTHER', legislation: 'Test Legislation Reference' });
    expect(screen.getByLabelText('Legislation')).toHaveValue('Test Legislation Reference');
    expect(screen.getByLabelText('England or Wales', { selector: 'input[readonly]' }))
      .toHaveValue('Building Regulations 2010 (Part B)');
    expect(screen.getByLabelText('Jersey', { selector: 'input[readonly]' }))
      .toHaveValue('Building Bye Laws (Jersey) 2007 (Part 2)');
  });

  it('dispatches the legislation text', () => {
    const { dispatch } = renderSection({ country: 'OTHER' });
    fireEvent.change(screen.getByLabelText('Legislation'), { target: { value: 'Test Legislation Reference' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_PROJECT', field: 'legislation', value: 'Test Legislation Reference' });
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

  it('clears a typed legislation when leaving Other', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'country', value: 'OTHER' }));
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'legislation', value: 'Test Legislation Reference' }));
    expect(result.current.state.project.legislation).toBe('Test Legislation Reference');
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'country', value: 'EW' }));
    expect(result.current.state.project.legislation).toBe('');
  });

  it('sends the VAT choice for Other in the generated request', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'country', value: 'OTHER' }));
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'vat_applicable', value: true }));
    const request = result.current.buildRequest();
    expect(request.project.country).toBe('OTHER');
    expect(request.project.vat_applicable).toBe(true);
  });

  it('sends the custom legislation for Other in the generated request', () => {
    const { result } = renderHook(() => useFeeProposal());
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'country', value: 'OTHER' }));
    act(() => result.current.dispatch({ type: 'SET_PROJECT', field: 'legislation', value: 'Test Legislation Reference' }));
    expect(result.current.buildRequest().project.legislation).toBe('Test Legislation Reference');
  });
});
