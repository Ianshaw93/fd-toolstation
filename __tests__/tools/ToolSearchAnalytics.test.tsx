import { act, fireEvent, render, screen } from '@testing-library/react';
import ToolSearch from '../../components/home/ToolSearch';
import { TOOL_SEARCH_CLICK_PATH, TOOL_SEARCH_LOG_PATH, resetAnalyticsState } from '../../lib/tools/analytics';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('ToolSearch analytics wiring', () => {
  const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response));

  function fetchCalls(): Array<[string, RequestInit]> {
    return fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
  }

  function postedJson(path: string): Record<string, unknown> {
    const call = fetchCalls().find((entry) => entry[0] === path);
    if (!call) throw new Error(`no POST to ${path}`);
    return JSON.parse(String(call[1].body)) as Record<string, unknown>;
  }

  beforeEach(() => {
    resetAnalyticsState();
    fetchMock.mockClear();
    push.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not POST on every keystroke; logs once after the debounce', () => {
    render(
      <ToolSearch cfdStatus={null}>
        <p>carousel</p>
      </ToolSearch>,
    );
    fireEvent.change(screen.getByPlaceholderText('Search tools...'), { target: { value: 'b' } });
    fireEvent.change(screen.getByPlaceholderText('Search tools...'), { target: { value: 'br' } });
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(400);
    });

    const logCalls = fetchCalls().filter((call) => call[0] === TOOL_SEARCH_LOG_PATH);
    expect(logCalls).toHaveLength(1);
    const body = postedJson(TOOL_SEARCH_LOG_PATH);
    expect(body.query).toBe('br');
    expect(body.resultCount).toBeGreaterThan(3);
  });

  it('logs a click with the same clientSearchId when a result is opened', () => {
    render(
      <ToolSearch cfdStatus={null}>
        <p>carousel</p>
      </ToolSearch>,
    );
    fireEvent.change(screen.getByPlaceholderText('Search tools...'), { target: { value: 'br' } });
    fireEvent.click(document.querySelector('[data-tool-id="efs-calculator"]') as HTMLElement);

    const searchBody = postedJson(TOOL_SEARCH_LOG_PATH);
    const clickBody = postedJson(TOOL_SEARCH_CLICK_PATH);
    expect(clickBody.partId).toBe('efs-calculator');
    expect(clickBody.clientSearchId).toBe(searchBody.clientSearchId);
    expect(clickBody.rank).toBe(1);
  });
});
