import { NextResponse } from 'next/server';
import { forwardToolSearchEvent, isClickEvent } from '../../../../lib/tools/analytics-forward';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isClickEvent(body)) {
    return NextResponse.json({ error: 'invalid tool-search click' }, { status: 400 });
  }
  await forwardToolSearchEvent('click', body, request.headers);
  return new NextResponse(null, { status: 204 });
}
