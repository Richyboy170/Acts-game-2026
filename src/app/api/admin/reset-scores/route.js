import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin.js';
import { isSameOriginRequest, jsonError, requestHasAdminSession } from '@/lib/admin-request.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const session = requestHasAdminSession(request);
  if (!session) return jsonError('Sign in before resetting scores.', 401);
  if (!isSameOriginRequest(request)) return jsonError('Request origin was not accepted.', 403);

  let body;
  try { body = await request.json(); }
  catch { return jsonError('Confirm the event reset to continue.'); }
  if (body?.confirmation !== 'RESET') return jsonError('Type RESET in the confirmation dialog before deleting scores.');

  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase.rpc('reset_event_scores', {
      p_actor: session.username,
      p_confirmation: body.confirmation,
    });
    if (error) {
      if (error.code === 'P0001') return jsonError(error.message);
      throw error;
    }
    return NextResponse.json({ ...data, deletedEntries: data?.deleted_entries ?? 0 });
  } catch (error) {
    console.error('Unable to reset event scores:', error.message);
    return jsonError('The scores could not be reset. Apply the event reset migration and check the Supabase setup.', 503);
  }
}
