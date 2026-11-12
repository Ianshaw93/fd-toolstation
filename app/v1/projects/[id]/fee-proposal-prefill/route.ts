import { NextRequest, NextResponse } from 'next/server';
import { callerAuthorization, directoryPrefillUrl, forwardToDirectory, signInRequired } from '../../../../../lib/directory-upstream';
import { isProjectRef } from '../../../../../lib/vendor/fd-directory-client';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = callerAuthorization(req.headers.get('authorization'));
  if (!authorization) return signInRequired();
  const { id } = await params;
  if (!isProjectRef(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return forwardToDirectory(directoryPrefillUrl(id), authorization);
}
