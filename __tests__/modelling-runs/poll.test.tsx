import { render } from '@testing-library/react';
import ToolBrowser from '../../components/home/ToolBrowser';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../lib/cfd-api', () => ({
  fetchDashboardState: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../lib/tools/analytics', () => ({
  TOOL_SEARCH_DEBOUNCE_MS: 400,
  ensureSearchLogged: jest.fn(),
  logToolSearchClick: jest.fn(),
}));

describe('home CFD poll', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes the home card about every 10s', () => {
    const spy = jest.spyOn(window, 'setInterval');
    render(<ToolBrowser />);
    const delays = spy.mock.calls.map((call) => call[1]);
    expect(delays).toContain(10_000);
    expect(delays).not.toContain(15_000);
  });
});
