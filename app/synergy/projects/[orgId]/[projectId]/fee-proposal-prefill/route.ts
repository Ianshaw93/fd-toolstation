import { NextRequest, NextResponse } from 'next/server';
import {
  callerAuthorization,
  directoryPrefillUrl,
  forwardToDirectory,
  signInRequired,
} from '../../../../../../lib/directory-upstream';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; projectId: string }> },
) {
  const authorization = callerAuthorization(req.headers.get('authorization'));
  if (!authorization) return signInRequired();
  const { orgId, projectId } = await params;
  const url = directoryPrefillUrl(orgId, projectId);
  if (!url) return NextResponse.json({ error: 'invalid_project_id' }, { status: 400 });
  return forwardToDirectory(url, authorization);
}
