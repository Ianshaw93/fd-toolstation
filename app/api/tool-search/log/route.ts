import { NextResponse } from 'next/server';
import { forwardToolSearchEvent, isLogEvent } from '../../../../lib/tools/analytics-forward';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isLogEvent(body)) {
    return NextResponse.json({ error: 'invalid tool-search log' }, { status: 400 });
  }
  await forwardToolSearchEvent('log', body, request.headers);
  return new NextResponse(null, { status: 204 });
}
