import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import TextBlockPreview from '../components/fee-proposal/TextBlockPreview';

test('bullet_list renders one list item per non-empty line', () => {
  render(<TextBlockPreview kind="bullet_list" content={'Alpha\n\nBeta\nGamma'} placeholders={[]} />);
  const items = screen.getAllByRole('listitem').map((li) => li.textContent);
  expect(items).toEqual(['Alpha', 'Beta', 'Gamma']); // blank line dropped
});

test('paragraph renders prose, not a list', () => {
  render(<TextBlockPreview kind="paragraph" content="Hello world" placeholders={[]} />);
  expect(screen.getByText('Hello world')).toBeInTheDocument();
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
});

test('template highlights placeholder tokens so they stand out from prose', () => {
  render(
    <TextBlockPreview kind="template" content="Per {legislation} rules." placeholders={['legislation']} />,
  );
  // The token is shown verbatim, marked up distinctly from the surrounding text.
  expect(screen.getByText('{legislation}')).toBeInTheDocument();
});
