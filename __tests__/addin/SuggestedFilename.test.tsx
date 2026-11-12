import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuggestedFilename from '../../components/addin/SuggestedFilename';
import type { NamedProposalResult } from '../../lib/word-ops';

describe('SuggestedFilename component with Create named proposal button', () => {
  const FILENAME = '0602 Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26';

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders suggested filename, copy button, and "Create named proposal" button', () => {
    render(<SuggestedFilename filename={FILENAME} documentSaved={false} />);

    expect(screen.getByTestId('suggested-filename')).toHaveTextContent(FILENAME);
    expect(screen.getByRole('button', { name: 'Copy suggested filename' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create named proposal' })).toBeInTheDocument();
  });

  it('copies filename when Copy button is clicked', async () => {
    render(<SuggestedFilename filename={FILENAME} documentSaved={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Copy suggested filename' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(FILENAME);
    expect(await screen.findByRole('button', { name: 'Copied suggested filename' })).toBeInTheDocument();
  });

  it('calls createNamedDocument and displays saved success message on Path A', async () => {
    const mockCreate = jest.fn(async (): Promise<NamedProposalResult> => ({
      path: 'A',
      saved: true,
      filename: FILENAME,
      savedLocation: 'C:\\Users\\IanShaw\\OneDrive\\0602.docx',
    }));

    render(
      <SuggestedFilename
        filename={FILENAME}
        documentSaved={true}
        onCreateNamedDocument={mockCreate}
      />
    );

    const button = screen.getByRole('button', { name: 'Create named proposal' });
    await userEvent.click(button);

    expect(mockCreate).toHaveBeenCalledWith(FILENAME);

    // Expect outcome message
    expect(
      await screen.findByText(new RegExp(`Saved as ${FILENAME}`, 'i'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Move it to the project folder \(e\.g\. Dropbox\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/C:\\Users\\IanShaw\\OneDrive\\0602\.docx/)).toBeInTheDocument();
    // Copy button is still present
    expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
  });

  it('displays message on Path B (saved without location)', async () => {
    const mockCreate = jest.fn(async (): Promise<NamedProposalResult> => ({
      path: 'B',
      saved: true,
      filename: FILENAME,
      savedLocation: null,
    }));

    render(
      <SuggestedFilename
        filename={FILENAME}
        documentSaved={false}
        onCreateNamedDocument={mockCreate}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create named proposal' }));

    expect(
      await screen.findByText(new RegExp(`Saved as ${FILENAME}`, 'i'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Move it to the project folder \(e\.g\. Dropbox\)/i)
    ).toBeInTheDocument();
  });

  it('displays fallback message on Path C (opened without direct saving)', async () => {
    const mockCreate = jest.fn(async (): Promise<NamedProposalResult> => ({
      path: 'C',
      saved: false,
      filename: FILENAME,
      savedLocation: null,
    }));

    render(
      <SuggestedFilename
        filename={FILENAME}
        documentSaved={true}
        onCreateNamedDocument={mockCreate}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create named proposal' }));

    expect(
      await screen.findByText(/Opened in a new document\. Save As and use the copied filename\./i)
    ).toBeInTheDocument();
    // Copy button is still present
    expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
  });

  it('displays error message when document creation fails', async () => {
    const mockCreate = jest.fn(async () => {
      throw new Error('Word is busy');
    });

    render(
      <SuggestedFilename
        filename={FILENAME}
        documentSaved={true}
        onCreateNamedDocument={mockCreate}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create named proposal' }));

    expect(await screen.findByText(/Word is busy/i)).toBeInTheDocument();
  });
});
