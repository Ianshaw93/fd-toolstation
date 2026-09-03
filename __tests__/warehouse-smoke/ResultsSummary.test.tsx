import { render, screen } from '@testing-library/react';

import ResultsSummary from '../../components/warehouse-smoke/ResultsSummary';
import { calculateSmokeLayer } from '../../lib/smoke-layer-calc';
import type { SmokeLayerInputs } from '../../lib/smoke-layer-types';

const PROJECT_SHED: SmokeLayerInputs = {
  roomArea: 43047,
  rackingPerc: 0.33,
  roomHeight: 15,
  fgr: 0.188,
  detectionTime: 60,
  preMovementTime: 180,
  maximumTravelDistance: 115,
  walkingSpeed: 1.2,
  totalExitWidth: 17,
  flowRate: 1.33,
  occupancy: 1431,
  assessmentTime: 1200,
  tenabilityHeight: 5.3,
  tstep: 1,
};

const TIGHT_SHAFT: SmokeLayerInputs = {
  ...PROJECT_SHED,
  roomArea: 25,
  rackingPerc: 0,
  maximumTravelDistance: 2.5,
  totalExitWidth: 1,
  occupancy: 1,
  tenabilityHeight: 2,
};

describe('ResultsSummary — tenability maintained, ASET reached', () => {
  beforeEach(() => {
    const results = calculateSmokeLayer(PROJECT_SHED);
    render(<ResultsSummary results={results} assessmentTime={1200} tenabilityHeight={5.3} />);
  });

  it('leads with the verdict', () => {
    expect(screen.getByText('Tenability maintained')).toBeInTheDocument();
  });

  it('shows the margin of safety as the hero figure', () => {
    expect(screen.getByText('+797')).toBeInTheDocument();
  });

  it('names the tenability height it assessed', () => {
    expect(screen.getByText(/reaches the 5\.3 m tenability height at/)).toBeInTheDocument();
    expect(screen.getByText('Layer at 5.3 m')).toBeInTheDocument();
  });

  it('shows the ASET tile and the pre-evacuation time', () => {
    // Once in the sentence, once in the ASET tile.
    expect(screen.getAllByText('1,197 s')).toHaveLength(2);
    expect(screen.getByText('Pre-evacuation time')).toBeInTheDocument();
    expect(screen.getByText('336 s')).toBeInTheDocument();
  });

  it('does not mention a reference height', () => {
    expect(screen.queryByText(/reference/i)).not.toBeInTheDocument();
  });
});

describe('ResultsSummary — tenability never reached', () => {
  beforeEach(() => {
    const results = calculateSmokeLayer({ ...PROJECT_SHED, tenabilityHeight: 2 });
    render(<ResultsSummary results={results} assessmentTime={1200} tenabilityHeight={2} />);
  });

  it('says ASET was never reached rather than showing the placeholder', () => {
    expect(screen.getByText('Never breached')).toBeInTheDocument();
    expect(screen.getByText('> 1,200 s')).toBeInTheDocument();
  });

  it('reports the margin as a lower bound', () => {
    expect(screen.getByText('+800')).toBeInTheDocument();
    expect(screen.getByText(/seconds margin of safety \(at least\)/)).toBeInTheDocument();
    expect(screen.getByText(/does not reach the 2 m tenability height/)).toBeInTheDocument();
  });
});

describe('ResultsSummary — tenability exceeded', () => {
  beforeEach(() => {
    const results = calculateSmokeLayer(TIGHT_SHAFT);
    render(<ResultsSummary results={results} assessmentTime={1200} tenabilityHeight={2} />);
  });

  it('flags that the limits are exceeded', () => {
    expect(screen.getByText('Tenability limits exceeded')).toBeInTheDocument();
  });

  it('shows a negative margin of safety', () => {
    expect(screen.getByText('-190')).toBeInTheDocument();
  });
});
