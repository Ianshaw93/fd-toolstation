import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import ManageWordingDrawer from '../components/fee-proposal/ManageWordingDrawer';
import * as api from '../lib/fee-api';
import type { TextBlock } from '../lib/fee-types';

jest.mock('../lib/fee-api');

const blocks: TextBlock[] = [
  { key: 'INTRO_OPEN_PLAN', label: 'Intro Open Plan', kind: 'paragraph', group_name: 'Introductions', sort_order: 0, content: 'intro', placeholders: [] },
  { key: 'STAGE_1_SCOPE', label: 'Stage 1 Scope', kind: 'bullet_list', group_name: 'RIBA Stage 1', sort_order: 1, content: 'bullet', placeholders: [] },
];

beforeEach(() => {
  jest.clearAllMocks();
  (api.fetchTextBlocks as jest.Mock).mockResolvedValue(blocks);
});

test('renders nothing while closed (and does not fetch)', () => {
  render(<ManageWordingDrawer open={false} onClose={jest.fn()} />);
  expect(screen.queryByText('Introductions')).not.toBeInTheDocument();
  expect(api.fetchTextBlocks).not.toHaveBeenCalled();
});

test('lists every standard-wording group when open', async () => {
  render(<ManageWordingDrawer open onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getByText('Introductions')).toBeInTheDocument());
  expect(screen.getByText('RIBA Stage 1')).toBeInTheDocument();
});
