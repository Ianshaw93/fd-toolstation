import { NextRequest, NextResponse } from 'next/server';
import { proxyCfdDashboard } from '../../../../lib/modelling-runs/proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ path?: string[] }> };

async function handle(request: NextRequest, context: Context) {
  const { path = [] } = await context.params;
  const bodyText = request.method === 'GET' || request.method === 'HEAD' ? null : await request.text();
  const result = await proxyCfdDashboard({
    method: request.method,
    pathSegments: path,
    searchParams: request.nextUrl.searchParams,
    bodyText,
  });
  return new NextResponse(result.body, {
    status: result.status,
    headers: {
      'content-type': result.contentType,
      'cache-control': 'no-store',
    },
  });
}

export const GET = handle;
export const POST = handle;
