import { NextResponse } from 'next/server';
import { verifyMicrosoftIdToken } from '../../../../lib/msauth';
import { createSessionToken, sessionCookieAttributes, type AddinSession } from '../../../../lib/auth-session';

interface RequestBody {
  idToken?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.idToken || typeof body.idToken !== 'string') {
    return NextResponse.json({ message: 'Missing idToken.' }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyMicrosoftIdToken(body.idToken);
  } catch (err) {
    console.error('microsoft login: token verification failed:', err);
    return NextResponse.json(
      { message: 'Microsoft sign-in could not be verified. Try again.' },
      { status: 401 },
    );
  }

  const sessionToken = createSessionToken(identity);
  const cookieAttrs = sessionCookieAttributes(request);

  const response = NextResponse.json({
    ok: true,
    email: identity.email,
    name: identity.name,
    token: sessionToken,
  });

  response.cookies.set({
    name: cookieAttrs.name,
    value: sessionToken,
    httpOnly: cookieAttrs.httpOnly,
    secure: cookieAttrs.secure,
    sameSite: cookieAttrs.sameSite,
    path: cookieAttrs.path,
    maxAge: cookieAttrs.maxAge,
  });

  return response;
}
