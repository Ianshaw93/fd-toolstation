import { NextRequest, NextResponse } from 'next/server';
import { callerAuthorization, directoryPrefillUrl } from '../../../../../../lib/directory-upstream';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; projectId: string }> },
) {
  const authorization = callerAuthorization(req.headers.get('authorization'));
  if (!authorization) {
    return NextResponse.json({ error: 'unauthorized', code: 'sign_in_required' }, { status: 401 });
  }
  const { projectId } = await params;
  const upstream = await fetch(directoryPrefillUrl(projectId), {
    headers: { Accept: 'application/json', Authorization: authorization },
    cache: 'no-store',
  });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
