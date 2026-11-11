import { NextRequest, NextResponse } from 'next/server';
import { MOCK_SYNERGY_PROJECTS } from '../../../lib/mock-synergy-data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const includeInactive = searchParams.get('include_inactive') === 'true';
  const forceStale = searchParams.get('force_stale') === 'true';
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10));

  // Inactive & archived are hidden by default unless requested
  let matches = MOCK_SYNERGY_PROJECTS.filter((p) => {
    if (!includeInactive && (!p.active || p.status.toLowerCase() === 'archived')) {
      return false;
    }
    if (!q) return true;
    return (
      p.numberFormatted.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.label.toLowerCase().includes(q)
    );
  });

  const total = matches.length;
  matches = matches.slice(0, limit);

  return NextResponse.json({
    items: matches.map((m) => ({
      synergy_project_id: m.synergy_project_id,
      organisation_id: m.organisation_id,
      label: m.label,
      status: m.status,
      active: m.active,
      name: m.name,
      project_number: m.numberFormatted,
      location: m.location,
      client_name: m.client_name,
      manager: m.manager,
    })),
    cache: {
      stale: forceStale,
      last_success_at: '2026-11-11T10:00:00Z',
      last_attempt_at: '2026-11-11T10:00:00Z',
      last_error: null,
    },
    result_total: total,
  });
}
