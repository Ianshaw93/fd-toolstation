import { NextRequest, NextResponse } from 'next/server';
import { callerSession, directoryPrefillUrl, forwardToDirectory, sessionRequired } from '../../../../../lib/directory-upstream';
import { isProjectRef } from '../../../../../lib/vendor/fd-directory-client';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = callerSession(req);
  if (!session) return sessionRequired();
  const { id } = await params;
  if (!isProjectRef(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return forwardToDirectory(directoryPrefillUrl(id), session.email);
}
