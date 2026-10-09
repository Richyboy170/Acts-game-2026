import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from './admin-auth.js';

export function requestHasAdminSession(request) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSession(token, secret);
}

export function isSameOriginRequest(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
