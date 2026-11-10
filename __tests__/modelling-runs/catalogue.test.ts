import { CATALOGUE, dashboardCards } from '../../lib/tools/catalogue';
import { searchTools } from '../../lib/tools/search';

describe('CFD dashboard card', () => {
  it('is on the home carousel', () => {
    const card = CATALOGUE.find((tool) => tool.id === 'cfd-dashboard');
    expect(card?.shelved).toBeFalsy();
    expect(dashboardCards().some((tool) => tool.id === 'cfd-dashboard')).toBe(true);
  });

  it('is findable for cfd and fds, including an empty browse', () => {
    expect(searchTools('').matches.some((tool) => tool.id === 'cfd-dashboard')).toBe(true);
    expect(searchTools('cfd').matches.some((tool) => tool.id === 'cfd-dashboard')).toBe(true);
    expect(searchTools('fds').matches.some((tool) => tool.id === 'cfd-dashboard')).toBe(true);
  });
});
