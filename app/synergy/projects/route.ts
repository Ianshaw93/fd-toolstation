import { NextRequest } from 'next/server';
import {
  callerAuthorization,
  directorySearchUrl,
  forwardToDirectory,
  signInRequired,
} from '../../../lib/directory-upstream';

export async function GET(req: NextRequest) {
  const authorization = callerAuthorization(req.headers.get('authorization'));
  if (!authorization) return signInRequired();
  return forwardToDirectory(directorySearchUrl(req.nextUrl.searchParams.toString()), authorization);
}
