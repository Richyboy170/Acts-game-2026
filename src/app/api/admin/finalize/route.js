import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin.js';
import { isSameOriginRequest, jsonError, requestHasAdminSession } from '@/lib/admin-request.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const session = requestHasAdminSession(request);
  if (!session) return jsonError('Sign in before locking the event results.', 401);
  if (!isSameOriginRequest(request)) return jsonError('Request origin was not accepted.', 403);

  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase.rpc('lock_event_results', { p_actor: session.username });
    if (error) {
      if (error.code === 'P0001') return jsonError(error.message);
      throw error;
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Unable to finalize event results:', error.message);
    return jsonError('The event results could not be locked. Check the Supabase setup and try again.', 503);
  }
}
