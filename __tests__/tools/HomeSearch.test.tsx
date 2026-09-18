import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolBrowser from '../../components/home/ToolBrowser';
import { UPLOAD_CANVAS_ORIGIN } from '../../lib/tools/catalogue';
import { logToolSearchClick } from '../../lib/tools/analytics';

const push = jest.fn();
const open = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('../../lib/cfd-api', () => ({
  fetchDashboardState: jest.fn(() => new Promise(() => {})),
}));

jest.mock('../../lib/tools/analytics', () => ({
  TOOL_SEARCH_DEBOUNCE_MS: 400,
  ensureSearchLogged: jest.fn(),
  logToolSearchClick: jest.fn(),
}));

describe('ToolBrowser search', () => {
  beforeEach(() => {
    push.mockReset();
    open.mockReset();
    window.open = open as unknown as typeof window.open;
  });

  it('shows dashboard cards when the query is empty', () => {
    render(<ToolBrowser />);
    expect(screen.getByRole('heading', { name: 'Sprinkler Grid Calculator' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'PDF Markup Tools' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Warehouse Smoke Layer' })).toBeInTheDocument();
    expect(screen.queryByTestId('tool-suggestion')).not.toBeInTheDocument();
  });

  it('filters visible cards as the engineer types', async () => {
    const user = userEvent.setup();
    render(<ToolBrowser />);
    await user.type(screen.getByPlaceholderText('Search tools...'), 'sprinkler');
    expect(document.querySelector('[data-tool-id="sprinkler-grid"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tool-id="warehouse-smoke"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-tool-id="upload-canvas"]')).not.toBeInTheDocument();
  });

  it('clears the query on Escape and keeps focus in the search box', async () => {
    const user = userEvent.setup();
    render(<ToolBrowser />);
    const input = screen.getByPlaceholderText('Search tools...');
    await user.type(input, 'sprinkler');
    expect(screen.queryByRole('heading', { name: 'Warehouse Smoke Layer' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Warehouse Smoke Layer' })).toBeInTheDocument();
  });

  it('shows an empty message instead of a blank carousel', async () => {
    const user = userEvent.setup();
    render(<ToolBrowser />);
    await user.type(screen.getByPlaceholderText('Search tools...'), 'bananas');
    expect(screen.getByTestId('tool-search-empty')).toHaveTextContent('No tools match that search');
    expect(screen.queryByRole('heading', { name: 'Sprinkler Grid Calculator' })).not.toBeInTheDocument();
  });

  it('surfaces Upload Canvas → External Fire Spread with a mode deep link for Ian’s NL phrase', async () => {
    const user = userEvent.setup();
    render(<ToolBrowser />);
    await user.type(
      screen.getByPlaceholderText('Search tools...'),
      'external fire spread tool where I draw on warehouse plans',
    );
    const suggestion = screen.getByTestId('tool-suggestion');
    expect(suggestion).toHaveTextContent("You're likely looking for:");
    expect(suggestion).toHaveTextContent('Upload Canvas → External Fire Spread');
    expect(screen.getByRole('button', { name: 'Open in External Fire Spread mode' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open in External Fire Spread mode' }));
    expect(open).toHaveBeenCalledWith(
      `${UPLOAD_CANVAS_ORIGIN}/?mode=efs`,
      '_blank',
      'noopener,noreferrer',
    );
    expect(logToolSearchClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'upload-canvas-efs' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('shows more than three palette rows for query "br"', async () => {
    const user = userEvent.setup();
    render(<ToolBrowser />);
    await user.type(screen.getByPlaceholderText('Search tools...'), 'br');
    expect(screen.getAllByRole('option').length).toBeGreaterThan(3);
    expect(document.querySelector('[data-tool-id="efs-calculator"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tool-id="upload-canvas-efs"]')).toBeInTheDocument();
  });
});
