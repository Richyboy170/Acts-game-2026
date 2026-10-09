import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_MS, createAdminSession } from '@/lib/admin-auth.js';
import { isAdminLoginConfigured, verifyAdminCredentials } from '@/lib/admin-config.js';
import { isSameOriginRequest, requestHasAdminSession } from '@/lib/admin-request.js';

export const runtime = 'nodejs';

export async function GET(request) {
  const session = requestHasAdminSession(request);
  const configured = isAdminLoginConfigured();
  return NextResponse.json({ configured, authenticated: Boolean(session), username: session?.username ?? null });
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request origin was not accepted.' }, { status: 403 });

  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!isAdminLoginConfigured()) {
    return NextResponse.json({ error: 'Admin login is not configured. Complete the server environment settings first.' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 });
  }

  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const matches = verifyAdminCredentials(username, body?.password);
  if (!matches) return NextResponse.json({ error: 'That username or password is not correct.' }, { status: 401 });

  const response = NextResponse.json({ authenticated: true, username });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: createAdminSession(username, secret),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  });
  return response;
}
