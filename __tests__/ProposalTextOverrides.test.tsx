import '@testing-library/jest-dom';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalTextOverrides from '../components/fee-proposal/ProposalTextOverrides';
import * as api from '../lib/fee-api';
import type { ServiceConfig, TextBlock, FeeProposalRequest } from '../lib/fee-types';

jest.mock('../lib/fee-api');

function off(): ServiceConfig {
  return {
    included: false, fee: 0, optional: false, limit_meetings: false,
    meeting_number: null, end_date_month: null, end_date_year: null,
    num_models: null, extended_travel_distance: false,
    hours_per_month: null, meetings_per_month: null,
  };
}

const blocks: TextBlock[] = [
  { key: 'INTRO_OPEN_PLAN', label: 'Intro Open Plan', kind: 'paragraph', group_name: 'Introductions', sort_order: 0, content: 'intro text', placeholders: [] },
  { key: 'STAGE_1_SCOPE', label: 'Stage 1 Scope', kind: 'bullet_list', group_name: 'RIBA Stage 1', sort_order: 1, content: 'first bullet line', placeholders: [] },
  { key: 'STAGE_3_X', label: 'Stage 3 Block', kind: 'paragraph', group_name: 'RIBA Stage 3', sort_order: 2, content: 's3', placeholders: [] },
];

function requestWithStage1(): FeeProposalRequest {
  const base14 = {
    stage_1: { ...off(), included: true }, stage_2: off(), london_plan: off(), gateway: off(),
    stage_3: off(), stage_4: off(), common_corridor_cfd: off(), open_plan_cfd: off(),
    warehouse_structural: off(), warehouse_cfd: off(), peer_review: off(),
  };
  const base5 = {
    construction_advice: off(), site_visits: off(), site_risk_assessment: off(),
    cfsmp: off(), phased_occupation: off(), client_monitoring: off(),
  };
  const base6 = { regulation_38: off(), ews1_forms: off(), rro_risk_assessment: off() };
  return {
    client: { first_name: 'A', surname: 'B', address_lines: [] },
    project: { project_name: 'P', project_location: 'L', country: 'EW' },
    fee_options: { engineer_name: '', pii_limit: 100000, include_hourly_rates: false },
    design_stages_1_4: base14, design_stages_5: base5, design_stages_6: base6,
  };
}

beforeEach(() => {
  (api.fetchTextBlocks as jest.Mock).mockResolvedValue(blocks);
  // Dry run says only the intro + stage 1 block will render (not stage 3).
  (api.fetchApplicableTextBlocks as jest.Mock).mockResolvedValue(['INTRO_OPEN_PLAN', 'STAGE_1_SCOPE']);
});

/** Stateful wrapper: the component is controlled, so wire overrides<->onChange
 *  to make inline edits actually persist (mirrors how FeeProposalForm uses it). */
function Harness({ initialOverrides = {} }: { initialOverrides?: Record<string, string> }) {
  const [ov, setOv] = useState<Record<string, string>>(initialOverrides);
  return <ProposalTextOverrides request={requestWithStage1()} overrides={ov} onChange={setOv} />;
}

async function expandStage1AndEdit(suffix = ' changed') {
  await waitFor(() => expect(screen.getByText('RIBA Stage 1')).toBeInTheDocument());
  await userEvent.click(screen.getByText('RIBA Stage 1'));
  const textarea = await screen.findByDisplayValue('first bullet line');
  await userEvent.type(textarea, suffix);
  return textarea;
}

test('Save as default appears only after a block is edited', async () => {
  render(<Harness />);
  await waitFor(() => expect(screen.getByText('RIBA Stage 1')).toBeInTheDocument());
  await userEvent.click(screen.getByText('RIBA Stage 1')); // expand group

  // Unedited: no permanent-save affordance.
  expect(screen.queryByRole('button', { name: /save as default/i })).not.toBeInTheDocument();

  const textarea = await screen.findByDisplayValue('first bullet line');
  await userEvent.type(textarea, ' changed');

  // Edited: the affordance to make it permanent shows up.
  expect(screen.getByRole('button', { name: /save as default/i })).toBeInTheDocument();
});

async function openSaveAsDefault() {
  await expandStage1AndEdit();
  await userEvent.click(screen.getByRole('button', { name: /save as default/i }));
}

test('permanent save is gated behind editor name + typing the block label', async () => {
  render(<Harness />);
  await openSaveAsDefault();

  const confirmBtn = screen.getByRole('button', { name: /make this the new default/i });
  expect(confirmBtn).toBeDisabled();

  // Name alone is not enough.
  await userEvent.type(screen.getByLabelText(/your name/i), 'Ian');
  expect(confirmBtn).toBeDisabled();

  // Wrong confirmation phrase stays blocked.
  const confirm = screen.getByLabelText(/to confirm/i);
  await userEvent.type(confirm, 'nope');
  expect(confirmBtn).toBeDisabled();

  // Exact block label + name unlocks the permanent save.
  await userEvent.clear(confirm);
  await userEvent.type(confirm, 'Stage 1 Scope');
  expect(confirmBtn).toBeEnabled();
});

test('confirming saves the new default and clears the per-proposal edit', async () => {
  const newContent = 'first bullet line changed';
  (api.updateTextBlock as jest.Mock).mockResolvedValue({
    ...blocks[1], content: newContent, updated_by: 'Ian',
  });

  render(<Harness />);
  await openSaveAsDefault(); // edits STAGE_1_SCOPE to 'first bullet line changed'

  await userEvent.type(screen.getByLabelText(/your name/i), 'Ian');
  await userEvent.type(screen.getByLabelText(/to confirm/i), 'Stage 1 Scope');
  await userEvent.click(screen.getByRole('button', { name: /make this the new default/i }));

  await waitFor(() =>
    expect(api.updateTextBlock).toHaveBeenCalledWith('STAGE_1_SCOPE', newContent, 'Ian'),
  );

  // Dialog closes and the per-proposal "edited" badge clears (override now equals the default).
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByText('edited')).not.toBeInTheDocument();
});

test('shows only groups whose blocks the proposal will render', async () => {
  render(<ProposalTextOverrides request={requestWithStage1()} overrides={{}} onChange={jest.fn()} />);

  await waitFor(() => expect(screen.getByText('Introductions')).toBeInTheDocument());
  expect(screen.getByText('RIBA Stage 1')).toBeInTheDocument();          // STAGE_1_SCOPE applicable
  expect(screen.queryByText('RIBA Stage 3')).not.toBeInTheDocument();    // STAGE_3_X not applicable
});

test('editing a block reports an override keyed by block key', async () => {
  const onChange = jest.fn();
  render(<ProposalTextOverrides request={requestWithStage1()} overrides={{}} onChange={onChange} />);

  await waitFor(() => expect(screen.getByText('RIBA Stage 1')).toBeInTheDocument());
  await userEvent.click(screen.getByText('RIBA Stage 1')); // expand group

  const textarea = await screen.findByDisplayValue('first bullet line');
  await userEvent.type(textarea, 'X');

  expect(onChange).toHaveBeenCalled();
  const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(Object.keys(last)).toContain('STAGE_1_SCOPE');
});
