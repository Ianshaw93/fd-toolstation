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
  referenceHeight: 5.3,
  tstep: 1,
};

const TIGHT_SHAFT: SmokeLayerInputs = {
  ...PROJECT_SHED,
  roomArea: 25,
  rackingPerc: 0,
  maximumTravelDistance: 2.5,
  totalExitWidth: 1,
  occupancy: 1,
  referenceHeight: 2,
};

describe('ResultsSummary — tenability maintained', () => {
  beforeEach(() => {
    const results = calculateSmokeLayer(PROJECT_SHED);
    render(
      <ResultsSummary results={results} assessmentTime={1200} referenceHeight={5.3} />,
    );
  });

  it('leads with the verdict', () => {
    expect(screen.getByText('Tenability maintained')).toBeInTheDocument();
  });

  it('shows the margin of safety as the hero figure', () => {
    expect(screen.getByText('+800')).toBeInTheDocument();
  });

  it('says ASET was never reached rather than showing the placeholder', () => {
    expect(screen.getByText('Never breached')).toBeInTheDocument();
    expect(screen.getByText('> 1,200 s')).toBeInTheDocument();
  });

  it('reports the reference height breach time', () => {
    expect(screen.getByText('Reference height (5.3 m)')).toBeInTheDocument();
    expect(screen.getByText('1,197 s')).toBeInTheDocument();
  });
});

describe('ResultsSummary — tenability exceeded', () => {
  beforeEach(() => {
    const results = calculateSmokeLayer(TIGHT_SHAFT);
    render(<ResultsSummary results={results} assessmentTime={1200} referenceHeight={2} />);
  });

  it('flags that the limits are exceeded', () => {
    expect(screen.getByText('Tenability limits exceeded')).toBeInTheDocument();
  });

  it('shows a negative margin of safety', () => {
    expect(screen.getByText('-190')).toBeInTheDocument();
  });
});
