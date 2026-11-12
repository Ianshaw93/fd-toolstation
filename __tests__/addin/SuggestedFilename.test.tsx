import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuggestedFilename from '../../components/addin/SuggestedFilename';
import type { NamedProposalResult } from '../../lib/word-ops';

describe('SuggestedFilename component (editable form field)', () => {
  const FILENAME = '0602 Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26';

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders suggested filename as an editable form input, with copy button and note', () => {
    render(
      <SuggestedFilename
        filename={FILENAME}
        suggestedFilename={FILENAME}
        documentSaved={false}
      />
    );

    const input = screen.getByTestId('suggested-filename');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(FILENAME);
    expect(screen.getByRole('button', { name: 'Copy suggested filename' })).toBeInTheDocument();
    expect(screen.getByTestId('suggested-filename-note')).toHaveTextContent(/suggest this name when you save/i);
    // Standalone "Create named proposal" button is removed; document creation is on Generate
    expect(screen.queryByRole('button', { name: 'Create named proposal' })).toBeNull();
  });

  it('allows editing the filename and calls onChange', async () => {
    const handleChange = jest.fn();
    render(
      <SuggestedFilename
        filename={FILENAME}
        suggestedFilename={FILENAME}
        onChange={handleChange}
        documentSaved={false}
      />
    );

    const input = screen.getByTestId('suggested-filename');
    await userEvent.type(input, ' - Draft');
    expect(handleChange).toHaveBeenCalled();
  });

  it('shows Reset button when filename is customized, and calls onReset', async () => {
    const handleReset = jest.fn();
    const CUSTOM = '0602 Brick House Farm Fee Proposal Custom';
    render(
      <SuggestedFilename
        filename={CUSTOM}
        suggestedFilename={FILENAME}
        onReset={handleReset}
        documentSaved={false}
      />
    );

    const resetButton = screen.getByRole('button', { name: 'Reset' });
    expect(resetButton).toBeInTheDocument();
    await userEvent.click(resetButton);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('copies filename when Copy button is clicked', async () => {
    render(
      <SuggestedFilename
        filename={FILENAME}
        suggestedFilename={FILENAME}
        documentSaved={false}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Copy suggested filename' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(FILENAME);
    expect(await screen.findByRole('button', { name: 'Copied suggested filename' })).toBeInTheDocument();
  });

  it('displays saved success banner when savedResult is provided (Path A / B)', () => {
    const savedResult: NamedProposalResult = {
      path: 'A',
      saved: true,
      filename: FILENAME,
      savedLocation: 'C:\\Users\\IanShaw\\Documents\\0602.docx',
    };

    render(
      <SuggestedFilename
        filename={FILENAME}
        suggestedFilename={FILENAME}
        documentSaved={true}
        savedResult={savedResult}
      />
    );

    expect(
      screen.getByTestId('saved-result-message')
    ).toHaveTextContent(new RegExp(`Saved as ${FILENAME}`, 'i'));
    expect(
      screen.getByText(/Move it to the project folder \(e\.g\. Dropbox\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/C:\\Users\\IanShaw\\Documents\\0602\.docx/)).toBeInTheDocument();
  });

  it('displays fallback banner when savedResult is provided with saved: false (Path C)', () => {
    const savedResult: NamedProposalResult = {
      path: 'C',
      saved: false,
      filename: FILENAME,
      savedLocation: null,
    };

    render(
      <SuggestedFilename
        filename={FILENAME}
        suggestedFilename={FILENAME}
        documentSaved={true}
        savedResult={savedResult}
      />
    );

    expect(
      screen.getByText(/Opened in a new document\. Save As and use the copied filename\./i)
    ).toBeInTheDocument();
  });
});
