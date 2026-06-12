import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ManageTextBlockEditor from '../components/fee-proposal/ManageTextBlockEditor';
import * as api from '../lib/fee-api';
import type { TextBlock } from '../lib/fee-types';

jest.mock('../lib/fee-api');

const block: TextBlock = {
  key: 'INTRO_OPEN_PLAN',
  label: 'Intro Open Plan',
  kind: 'paragraph',
  group_name: 'Introductions',
  sort_order: 0,
  content: 'original text',
  placeholders: [],
};

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
});

test('changing a default is gated behind the typed confirmation', async () => {
  (api.updateTextBlock as jest.Mock).mockResolvedValue({
    ...block, content: 'original text more', updated_by: 'Ian',
  });

  render(<ManageTextBlockEditor block={block} editorName="" />);

  await userEvent.type(screen.getByDisplayValue('original text'), ' more');
  await userEvent.click(screen.getByRole('button', { name: /save as default/i }));

  // Opening the dialog must not save anything yet.
  expect(api.updateTextBlock).not.toHaveBeenCalled();
  const confirmBtn = screen.getByRole('button', { name: /make this the new default/i });
  expect(confirmBtn).toBeDisabled();

  await userEvent.type(screen.getByLabelText(/your name/i), 'Ian');
  await userEvent.type(screen.getByLabelText(/to confirm/i), 'Intro Open Plan');
  await userEvent.click(confirmBtn);

  await waitFor(() =>
    expect(api.updateTextBlock).toHaveBeenCalledWith('INTRO_OPEN_PLAN', 'original text more', 'Ian'),
  );
});

test('reset falls back to the remembered editor name', async () => {
  window.localStorage.setItem('feeProposalEditorName', 'Sam');
  (api.resetTextBlock as jest.Mock).mockResolvedValue({ ...block, content: 'original text' });

  render(<ManageTextBlockEditor block={block} editorName="" />);
  await userEvent.click(screen.getByRole('button', { name: /^reset$/i }));

  await waitFor(() => expect(api.resetTextBlock).toHaveBeenCalledWith('INTRO_OPEN_PLAN', 'Sam'));
});
