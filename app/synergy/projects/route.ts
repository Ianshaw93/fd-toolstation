import { NextRequest, NextResponse } from 'next/server';
import { callerAuthorization, directorySearchUrl } from '../../../lib/directory-upstream';

export async function GET(req: NextRequest) {
  const authorization = callerAuthorization(req.headers.get('authorization'));
  if (!authorization) {
    return NextResponse.json({ error: 'unauthorized', code: 'sign_in_required' }, { status: 401 });
  }
  const upstream = await fetch(directorySearchUrl(req.nextUrl.searchParams.toString()), {
    headers: { Accept: 'application/json', Authorization: authorization },
    cache: 'no-store',
  });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
