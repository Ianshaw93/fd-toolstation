import { render, screen } from '@testing-library/react';
import FilterGridLayout from '../../components/home/search-layouts/FilterGridLayout';
import { searchTools } from '../../lib/tools/search';
import { UPLOAD_CANVAS_ORIGIN } from '../../lib/tools/catalogue';

describe('FilterGridLayout', () => {
  it('renders matcher output: part name, why, and efs mode deep-link CTA', () => {
    const onOpen = jest.fn();
    const result = searchTools('external fire spread tool where I draw on warehouse plans');
    render(<FilterGridLayout result={result} onOpen={onOpen} />);

    const suggestion = screen.getByTestId('tool-suggestion');
    expect(suggestion).toHaveTextContent("You're likely looking for:");
    expect(suggestion).toHaveTextContent('Upload Canvas → External Fire Spread');
    expect(screen.getByRole('button', { name: 'Open in External Fire Spread mode' })).toBeInTheDocument();

    screen.getByRole('button', { name: 'Open in External Fire Spread mode' }).click();
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'upload-canvas-efs',
        deepLink: `${UPLOAD_CANVAS_ORIGIN}/?mode=efs`,
      }),
    );
  });

  it('shows an empty message when the matcher has no hits', () => {
    const result = searchTools('bananas');
    render(<FilterGridLayout result={result} onOpen={jest.fn()} />);
    expect(screen.getByTestId('tool-search-empty')).toHaveTextContent('No tools match that search');
  });
});
