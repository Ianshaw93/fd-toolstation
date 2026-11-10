import { readFileSync } from 'fs';
import { join } from 'path';
import { CLOUDHPC_ENABLED, runDetailPath, runsListPath } from '../../lib/modelling-runs/client';

const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MACHINE_ID = '11111111-1111-4111-8111-111111111111';

describe('modelling runs client', () => {
  it('builds list and detail URLs the backend logs from', () => {
    expect(CLOUDHPC_ENABLED).toBe(false);
    const list = new URL(
      runsListPath({
        target: 'local',
        machine_id: MACHINE_ID,
        status: 'failed',
        q: 'hall',
        user: 'ian',
      }),
      'http://localhost',
    );
    expect(list.pathname).toBe('/api/cfd-dashboard/runs');
    expect(list.searchParams.get('target')).toBe('local');
    expect(list.searchParams.get('machine_id')).toBe(MACHINE_ID);
    expect(list.searchParams.get('status')).toBe('failed');
    expect(list.searchParams.get('q')).toBe('hall');
    expect(list.searchParams.get('user')).toBe('ian');

    const detail = new URL(
      runDetailPath(RUN_ID, { fromSearch: true, q: 'hall', user: 'ian' }),
      'http://localhost',
    );
    expect(detail.pathname).toBe(`/api/cfd-dashboard/runs/${RUN_ID}`);
    expect(detail.searchParams.get('from')).toBe('search');
    expect(detail.searchParams.get('q')).toBe('hall');
    expect(detail.searchParams.get('user')).toBe('ian');
  });

  it('omits an empty search so a plain list refresh is not logged', () => {
    expect(runsListPath({ q: '   ', user: '' })).toBe('/api/cfd-dashboard/runs');
    expect(runDetailPath(RUN_ID)).toBe(`/api/cfd-dashboard/runs/${RUN_ID}`);
  });

  it('does not mention the API key in browser code', () => {
    const files = [
      '../../lib/modelling-runs/client.ts',
      '../../lib/cfd-api.ts',
      '../../components/modelling-runs/ModellingRunsDashboard.tsx',
      '../../components/modelling-runs/RunDetailView.tsx',
      '../../components/home/ToolBrowser.tsx',
      '../../app/cfd-dashboard/page.tsx',
      '../../app/cfd-dashboard/runs/[id]/page.tsx',
    ];
    for (const file of files) {
      const src = readFileSync(join(__dirname, file), 'utf8');
      expect(src).not.toMatch(/FDS_API_KEY/);
      expect(src).not.toMatch(/X-API-Key/);
      expect(src).not.toMatch(/NEXT_PUBLIC_FDS/);
    }
  });
});
