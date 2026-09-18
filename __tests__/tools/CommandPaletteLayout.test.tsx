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

    expect(screen.getByTestId('suggestion-open-url')).toHaveTextContent(
      'https://upload-canvas.vercel.app/?mode=efs',
    );
    expect(screen.getByTestId('suggestion-open-url').textContent).not.toContain('upload-canvas-git-dev');

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

  it('lists more than 3 matches for query "br" and does not slice the matcher output', () => {
    const result = searchTools('br');
    const items = paletteItems(result);
    expect(result.matches.length).toBeGreaterThan(3);
    expect(items.length).toBeGreaterThan(3);
    expect(items.map((item) => item.id)).toEqual(
      expect.arrayContaining(['efs-calculator', 'upload-canvas-efs']),
    );

    render(<CommandPaletteLayout result={result} onOpen={jest.fn()} />);
    expect(screen.getAllByRole('option').length).toBeGreaterThan(3);
    expect(document.querySelector('[data-tool-id="efs-calculator"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tool-id="upload-canvas-efs"]')).toBeInTheDocument();
  });

  it('shows a Based on BR 187 line under radiation / EFS rows for query "br"', () => {
    const result = searchTools('br');
    render(<CommandPaletteLayout result={result} onOpen={jest.fn()} />);
    expect(screen.getByTestId('calc-source-upload-canvas-radiation')).toHaveTextContent(/Based on.*BR 187/i);
    expect(screen.getByTestId('calc-source-efs-calculator').textContent).toMatch(/BR 187|BRE 135/);
    expect(screen.getByTestId('calc-source-upload-canvas-efs').textContent).toMatch(/BR 187|BRE 135/);
    expect(screen.queryByTestId('calc-source-sprinkler-grid')).not.toBeInTheDocument();
  });

  it('shows a Based on 7974 line under warehouse for query "7974"', () => {
    const result = searchTools('7974');
    render(<CommandPaletteLayout result={result} onOpen={jest.fn()} />);
    const line = screen.getByTestId('calc-source-warehouse-smoke');
    expect(line).toHaveTextContent(/Based on.*7974/);
    expect(line).not.toHaveTextContent(/CIBSE/i);
    expect(screen.getByTestId('suggestion-calc-source')).toHaveTextContent(/7974/);
  });
});
