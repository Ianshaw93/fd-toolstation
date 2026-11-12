import { NextRequest } from 'next/server';
import { callerSession, directorySearchUrl, forwardToDirectory, sessionRequired } from '../../../lib/directory-upstream';

export async function GET(req: NextRequest) {
  const session = callerSession(req);
  if (!session) return sessionRequired();
  return forwardToDirectory(directorySearchUrl(req.nextUrl.searchParams), session.email);
}
