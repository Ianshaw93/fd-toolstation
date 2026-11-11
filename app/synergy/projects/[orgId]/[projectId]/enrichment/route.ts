import { NextResponse } from 'next/server';

// The documented Total Synergy v4 OpenAPI has no read for contacts on a project,
// a contact by id, or a contact address. This route does not proxy, does not
// embed a key, and does not invent a Client-role company or address.
export async function GET() {
  return NextResponse.json({
    client_role_available: false,
    reason: 'no_documented_project_contacts_read',
    client_role_id: 183340,
    not_client_role_id: 206928,
  });
}
