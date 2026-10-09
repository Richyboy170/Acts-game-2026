import { NextResponse } from 'next/server';
import { formatSupabaseResetError } from '@/lib/admin-errors.js';
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
      if (error.code === 'PGRST202' || error.code === '42883') {
        return jsonError("Supabase cannot find reset_event_scores. Confirm migration 202610090002 ran on the project configured in Vercel, then reload the Supabase API schema cache with: NOTIFY pgrst, 'reload schema';", 503);
      }
      if (error.code === '42501') {
        return jsonError('Supabase denied the reset function. Confirm Vercel uses the server-side secret/service-role key and that migration 202610090002 granted it permission.', 503);
      }
      throw error;
    }
    return NextResponse.json({ ...data, deletedEntries: data?.deleted_entries ?? 0 });
  } catch (error) {
    console.error('Unable to reset event scores:', { code: error.code, message: error.message });
    return jsonError(formatSupabaseResetError(error), 503);
  }
}
