import { NextResponse } from 'next/server';
import { GAME_BY_ID, TEAM_BY_ID } from '@/lib/catalog.js';
import { validateScoreChange } from '@/lib/scoreboard.js';
import { getAdminSupabase } from '@/lib/supabase/admin.js';
import { isSameOriginRequest, jsonError, requestHasAdminSession } from '@/lib/admin-request.js';

export const runtime = 'nodejs';

export async function GET(request) {
  if (!requestHasAdminSession(request)) return jsonError('Sign in to view score details.', 401);

  try {
    const supabase = getAdminSupabase();
    const [{ data: totals, error: totalsError }, { data: finalization, error: finalizationError }, { data: finalizationEvents, error: finalizationEventsError }] = await Promise.all([
      supabase.from('team_score_totals').select('game_id, team_id, total_points').order('team_id').order('game_id'),
      supabase.from('event_finalization_state').select('is_locked, results, locked_at, updated_at').eq('id', true).maybeSingle(),
      supabase.from('event_finalization_events').select('action, actor, created_at').order('created_at', { ascending: false }).limit(100),
    ]);
    if (totalsError || finalizationError || finalizationEventsError) throw totalsError || finalizationError || finalizationEventsError;
    const entries = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from('score_entries')
        .select('id, game_id, team_id, entry_type, points_delta, note, actor, idempotency_key, created_at')
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      entries.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return NextResponse.json({ totals: totals ?? [], entries, finalization: finalization ?? { is_locked: false, results: [] }, finalizationEvents: finalizationEvents ?? [] });
  } catch (error) {
    console.error('Unable to load admin scores:', error.message);
    return jsonError('Could not load the score history. Check the Supabase setup and try again.', 503);
  }
}

export async function POST(request) {
  const session = requestHasAdminSession(request);
  if (!session) return jsonError('Sign in before changing scores.', 401);
  if (!isSameOriginRequest(request)) return jsonError('Request origin was not accepted.', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('The score change could not be read.');
  }

  const game = GAME_BY_ID[body?.gameId];
  const team = TEAM_BY_ID[body?.teamId];
  const kind = body?.kind;
  const delta = Number(body?.delta);
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : null;
  const idempotencyKey = body?.idempotencyKey;
  if (!game || !team) return jsonError('Choose a valid game and team.');
  if (!['award', 'adjustment'].includes(kind)) return jsonError('Choose a valid score change type.');
  if (!Number.isInteger(delta) || delta === 0) return jsonError('Enter a non-zero whole number of points.');
  if (kind === 'award' && delta < 0) return jsonError('Awards must add a positive whole number of points.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey ?? '')) {
    return jsonError('Refresh the page before submitting this score again.');
  }

  try {
    const supabase = getAdminSupabase();
    const { data: current, error: currentError } = await supabase
      .from('team_score_totals')
      .select('total_points')
      .eq('game_id', game.id)
      .eq('team_id', team.id)
      .single();
    if (currentError) throw currentError;
    const validationError = validateScoreChange({ kind, delta, currentTotal: current.total_points });
    if (validationError) return jsonError(validationError);

    const { data, error } = await supabase.rpc('record_score_change', {
      p_game_id: game.id,
      p_team_id: team.id,
      p_points_delta: delta,
      p_entry_type: kind,
      p_note: note || null,
      p_actor: session.username,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      if (error.code === '23514' || error.code === 'P0001') return jsonError(error.message);
      throw error;
    }
    return NextResponse.json(data, { status: data?.duplicate ? 200 : 201 });
  } catch (error) {
    console.error('Unable to save score change:', error.message);
    return jsonError('The score could not be saved. Please retry; duplicate submissions are protected.', 503);
  }
}
