import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalTextOverrides from '../components/fee-proposal/ProposalTextOverrides';
import * as api from '../lib/fee-api';
import type { ServiceConfig, TextBlock } from '../lib/fee-types';

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

function stateWithStage1() {
  const base14: any = {
    stage_1: { ...off(), included: true }, stage_2: off(), london_plan: off(), gateway: off(),
    stage_3: off(), stage_4: off(), common_corridor_cfd: off(), open_plan_cfd: off(),
    warehouse_structural: off(), warehouse_cfd: off(), peer_review: off(),
  };
  const base5: any = {
    construction_advice: off(), site_visits: off(), site_risk_assessment: off(),
    cfsmp: off(), phased_occupation: off(), client_monitoring: off(),
  };
  const base6: any = { regulation_38: off(), ews1_forms: off(), rro_risk_assessment: off() };
  return { design_stages_1_4: base14, design_stages_5: base5, design_stages_6: base6 };
}

test('shows only groups for included sections', async () => {
  (api.fetchTextBlocks as jest.Mock).mockResolvedValue(blocks);
  render(<ProposalTextOverrides state={stateWithStage1()} overrides={{}} onChange={jest.fn()} />);

  await waitFor(() => expect(screen.getByText('Introductions')).toBeInTheDocument());
  expect(screen.getByText('RIBA Stage 1')).toBeInTheDocument();      // included
  expect(screen.queryByText('RIBA Stage 3')).not.toBeInTheDocument(); // not included
});

test('editing a block reports an override keyed by block key', async () => {
  (api.fetchTextBlocks as jest.Mock).mockResolvedValue(blocks);
  const onChange = jest.fn();
  render(<ProposalTextOverrides state={stateWithStage1()} overrides={{}} onChange={onChange} />);

  await waitFor(() => expect(screen.getByText('RIBA Stage 1')).toBeInTheDocument());
  await userEvent.click(screen.getByText('RIBA Stage 1')); // expand the group

  const textarea = await screen.findByDisplayValue('first bullet line');
  await userEvent.type(textarea, 'X');

  expect(onChange).toHaveBeenCalled();
  const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(Object.keys(last)).toContain('STAGE_1_SCOPE');
});
