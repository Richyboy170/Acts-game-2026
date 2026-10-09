import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-auth.js';
import { isSameOriginRequest, requestHasAdminSession } from '@/lib/admin-request.js';

export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request origin was not accepted.' }, { status: 403 });
  if (!requestHasAdminSession(request)) return NextResponse.json({ ok: true });
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: ADMIN_SESSION_COOKIE, value: '', httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
