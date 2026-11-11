import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; projectId: string }> }
) {
  // Acknowledges row selection logging without mutating or creating external entities.
  const { orgId, projectId } = await params;
  const body = await req.json().catch(() => ({}));

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Synergy Directory Mock] Opened project ${projectId} (Org ${orgId}), rank: ${body.rank ?? 0}`);
  }

  return new NextResponse(null, { status: 204 });
}
