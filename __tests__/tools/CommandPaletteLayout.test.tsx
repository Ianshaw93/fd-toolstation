import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommandPaletteLayout, { paletteItems } from '../../components/home/search-layouts/CommandPaletteLayout';
import { searchTools } from '../../lib/tools/search';
import { UPLOAD_CANVAS_ORIGIN } from '../../lib/tools/catalogue';

describe('paletteItems', () => {
  it('puts the suggested part first without duplicating it', () => {
    const result = searchTools('external fire spread tool where I draw on warehouse plans');
    const items = paletteItems(result);
    expect(items[0].id).toBe('upload-canvas-efs');
    expect(items.filter((item) => item.id === 'upload-canvas-efs')).toHaveLength(1);
  });
});

describe('CommandPaletteLayout', () => {
  it('renders matcher output: part name, why, and efs mode deep-link CTA', async () => {
    const onOpen = jest.fn();
    const result = searchTools('external fire spread tool where I draw on warehouse plans');
    render(<CommandPaletteLayout result={result} onOpen={onOpen} />);

    const suggestion = screen.getByTestId('tool-suggestion');
    expect(suggestion).toHaveTextContent("You're likely looking for:");
    expect(suggestion).toHaveTextContent('Upload Canvas → External Fire Spread');
    expect(screen.getByRole('button', { name: 'Open in External Fire Spread mode' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open in External Fire Spread mode' }));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'upload-canvas-efs',
        deepLink: `${UPLOAD_CANVAS_ORIGIN}/?mode=efs`,
      }),
    );
  });

  it('shows an empty message when the matcher has no hits', () => {
    const result = searchTools('bananas');
    render(<CommandPaletteLayout result={result} onOpen={jest.fn()} />);
    expect(screen.getByTestId('tool-search-empty')).toHaveTextContent('No tools match that search');
  });

  it('moves the active row with arrow keys and opens it on Enter', async () => {
    const onOpen = jest.fn();
    const result = searchTools('sprinkler');
    const user = userEvent.setup();
    render(<CommandPaletteLayout result={result} onOpen={onOpen} />);

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    if (options.length > 1) {
      expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
      await user.keyboard('{ArrowUp}');
    }

    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'sprinkler-grid' }));
  });
});
