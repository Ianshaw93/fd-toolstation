import { render, screen, fireEvent } from '@testing-library/react';
import ProjectDetailsSection from '../../components/efs/ProjectDetailsSection';
import type { ProjectDetails } from '../../lib/efs-types';

const defaultProps: ProjectDetails = {
  projectName: '',
  projectLocation: '',
  ribaDesignStage: '1',
  engineerName: '',
  clientName: '',
};

function renderSection(overrides: Partial<ProjectDetails> = {}) {
  const onChange = jest.fn();
  const props = { ...defaultProps, ...overrides };
  const result = render(
    <ProjectDetailsSection {...props} onChange={onChange} />
  );
  return { ...result, onChange };
}

describe('ProjectDetailsSection', () => {
  it('renders all five fields', () => {
    renderSection();
    expect(screen.getByLabelText('Project Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Project Location')).toBeInTheDocument();
    expect(screen.getByLabelText('RIBA Design Stage')).toBeInTheDocument();
    expect(screen.getByLabelText("Engineer's Name")).toBeInTheDocument();
    expect(screen.getByLabelText('Client Name')).toBeInTheDocument();
  });

  it('displays current values', () => {
    renderSection({ projectName: 'Test Project', ribaDesignStage: '3' });
    expect(screen.getByLabelText('Project Name')).toHaveValue('Test Project');
    expect(screen.getByLabelText('RIBA Design Stage')).toHaveValue('3');
  });

  it('calls onChange when a text field changes', () => {
    const { onChange } = renderSection();
    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'New Project' } });
    expect(onChange).toHaveBeenCalledWith('projectName', 'New Project');
  });

  it('calls onChange when RIBA stage changes', () => {
    const { onChange } = renderSection();
    fireEvent.change(screen.getByLabelText('RIBA Design Stage'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith('ribaDesignStage', '4');
  });

  it('renders RIBA dropdown with stages 1-6', () => {
    renderSection();
    const select = screen.getByLabelText('RIBA Design Stage') as HTMLSelectElement;
    expect(select.options).toHaveLength(6);
    expect(select.options[0].value).toBe('1');
    expect(select.options[5].value).toBe('6');
  });
});
